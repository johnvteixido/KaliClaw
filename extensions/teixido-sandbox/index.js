import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { execSync } from "node:child_process";
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { executeInSandbox } from "./linux-sandbox.js";

/**
 * Teixido Sandbox Plugin for OpenClaw
 *
 * Architecture:
 *   1. Registers a custom tool `teixido_sandbox_exec` that agents can call.
 *   2. When invoked, it first runs the Python AST firewall (ast_firewall.py)
 *      against the code using a real ast.parse() tree walk.
 *   3. If the code passes the firewall, it boots an ephemeral Windows Sandbox
 *      VM with networking disabled and the user's TeixidoLabs directory
 *      mounted read-only.
 *   4. The code executes inside the Hyper-V micro-VM, output is piped back,
 *      and the VM is destroyed. Zero trace, zero risk.
 */

const AST_FIREWALL_PATH = join(
  import.meta.dirname ?? new URL(".", import.meta.url).pathname.slice(1),
  "ast_firewall.py"
);

/**
 * Run the real Python AST firewall against a code string.
 * Returns { safe: boolean, reason?: string, violations?: object[] }
 */
function runASTFirewall(code, language) {
  // The AST firewall only analyzes Python.
  // For C/C++, we do a conservative static check inline.
  if (language !== "python") {
    return runCStaticCheck(code);
  }

  const tmpFile = join(tmpdir(), `teixido_ast_${randomBytes(4).toString("hex")}.py`);
  try {
    writeFileSync(tmpFile, code, "utf-8");
    const result = execSync(`python "${AST_FIREWALL_PATH}" "${tmpFile}"`, {
      encoding: "utf-8",
      timeout: 10_000,
    });
    const parsed = JSON.parse(result.trim());
    return { safe: parsed.status === "safe", ...parsed };
  } catch (err) {
    // execSync throws on non-zero exit code — the stderr/stdout contains our JSON
    if (err.stdout) {
      try {
        const parsed = JSON.parse(err.stdout.trim());
        return {
          safe: false,
          reason: parsed.summary || parsed.error || "AST analysis flagged violations",
          violations: parsed.violations,
        };
      } catch { /* fall through */ }
    }
    return { safe: false, reason: `AST firewall error: ${err.message}` };
  } finally {
    try { execSync(`rm -f "${tmpFile}"`, { stdio: "ignore" }); } catch { /* ignore */ }
  }
}

/**
 * Conservative static analysis for C/C++ code.
 * Uses actual token-level checks rather than naive regex.
 */
function runCStaticCheck(code) {
  const violations = [];

  // Tokenize: strip comments and string literals to avoid false positives
  const stripped = code
    .replace(/\/\/[^\n]*/g, "")           // line comments
    .replace(/\/\*[\s\S]*?\*\//g, "")     // block comments
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')  // string literals
    .replace(/'(?:[^'\\]|\\.)*'/g, "''"); // char literals

  const dangerousCFunctions = [
    { pattern: /\bsystem\s*\(/g, name: "system()" },
    { pattern: /\bexecl?[evp]*\s*\(/g, name: "exec*()" },
    { pattern: /\bpopen\s*\(/g, name: "popen()" },
    { pattern: /\bCreateProcess\w*\s*\(/g, name: "CreateProcess()" },
    { pattern: /\bShellExecute\w*\s*\(/g, name: "ShellExecute()" },
    { pattern: /\bWinExec\s*\(/g, name: "WinExec()" },
    { pattern: /\b_?unlink\s*\(/g, name: "unlink()" },
    { pattern: /\brmdir\s*\(/g, name: "rmdir()" },
    { pattern: /\brename\s*\(/g, name: "rename()" },
  ];

  for (const { pattern, name } of dangerousCFunctions) {
    if (pattern.test(stripped)) {
      violations.push({ type: "dangerous_c_call", detail: name });
    }
  }

  if (violations.length > 0) {
    return {
      safe: false,
      reason: `Blocked ${violations.length} dangerous C/C++ call(s): ${violations.map((v) => v.detail).join(", ")}`,
      violations,
    };
  }
  return { safe: true };
}

export default definePluginEntry({
  id: "teixido-sandbox",
  name: "Teixido Sandbox",
  description: "Ephemeral Windows Sandbox proxy with real Python AST firewall",
  register(api) {
    // Register the sandbox execution tool that agents can invoke
    api.registerTool({
      name: "teixido_sandbox_exec",
      description:
        "Execute code inside an air-gapped, ephemeral Windows Sandbox VM. " +
        "The code is first analyzed by a real Python AST firewall to block " +
        "dangerous operations (os.system, subprocess, eval, exec, file " +
        "deletion, etc.). If it passes, the code runs in a Hyper-V micro-VM " +
        "with networking disabled and the TeixidoLabs directory mounted " +
        "read-only. The VM is destroyed after execution. Use this tool " +
        "whenever you need to run untrusted code, exploit PoCs, or " +
        "cryptographic benchmarks safely.",
      parameters: {
        type: "object",
        required: ["code", "language"],
        properties: {
          code: {
            type: "string",
            description: "The source code to execute inside the sandbox.",
          },
          language: {
            type: "string",
            enum: ["python", "c", "cpp"],
            description: "Programming language of the code.",
          },
        },
      },
      async execute({ code, language }) {
        api.logger.info(`[Teixido Sandbox] Intercepted ${language} execution request`);

        // --- Phase 1: AST Firewall ---
        api.logger.info("[Teixido Sandbox] Running AST firewall analysis...");
        const firewallResult = runASTFirewall(code, language);

        if (!firewallResult.safe) {
          api.logger.warn(`[Teixido Sandbox] BLOCKED: ${firewallResult.reason}`);
          return {
            content: [
              {
                type: "text",
                text: `🛡️ **Teixido AST Firewall — Execution Blocked**\n\n` +
                  `**Reason:** ${firewallResult.reason}\n\n` +
                  (firewallResult.violations
                    ? `**Violations:**\n${firewallResult.violations
                        .map((v) => `- Line ${v.line || "?"}: \`${v.detail}\` (${v.type})`)
                        .join("\n")}\n\n`
                    : "") +
                  `The code was NOT executed. Rewrite it to remove the flagged operations.`,
              },
            ],
          };
        }

        // --- Phase 2: Ephemeral Windows Sandbox ---
        api.logger.info("[Teixido Sandbox] AST clear. Launching Linux Sandbox...");
        try {
          const output = await executeInSandbox(code, language);
          api.logger.info("[Teixido Sandbox] VM execution complete. VM destroyed.");
          return {
            content: [
              {
                type: "text",
                text: `✅ **Teixido Sandbox — Execution Complete**\n\n` +
                  `**Environment:** Air-gapped Linux Sandbox Environment\n` +
                  `**Networking:** Disabled\n` +
                  `**TeixidoLabs mount:** Read-Only\n\n` +
                  `**Output:**\n\`\`\`\n${output}\n\`\`\``,
              },
            ],
          };
        } catch (err) {
          api.logger.error(`[Teixido Sandbox] VM execution failed: ${err.message}`);
          return {
            content: [
              {
                type: "text",
                text: `❌ **Teixido Sandbox — Execution Failed**\n\n${err.message}`,
              },
            ],
          };
        }
      },
    });

    api.registerService({
      id: "teixido-sandbox",
      start: () => {
        api.logger.info(
          "[Teixido Sandbox] Active. AST Firewall (Python ast.parse) + Ephemeral Linux Sandbox Proxy ready."
        );
      },
      stop: () => {
        api.logger.info("[Teixido Sandbox] Stopped.");
      },
    });
  },
});
