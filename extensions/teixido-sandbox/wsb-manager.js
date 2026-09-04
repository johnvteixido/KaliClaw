import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { tmpdir } from "node:os";

const HOST_TEIXIDO_PATH = "<USER_HOME>\\.gemini\\antigravity\\scratch\\TeixidoLabs";

/**
 * Generate an air-gapped .wsb configuration.
 *
 * - Networking is DISABLED (complete air-gap).
 * - TeixidoLabs is mounted READ-ONLY.
 * - A writable scratch folder is mapped for payload + output.
 */
function generateWSBConfig(scratchDir) {
  return `<Configuration>
  <Networking>Disable</Networking>
  <MappedFolders>
    <MappedFolder>
      <HostFolder>${HOST_TEIXIDO_PATH}</HostFolder>
      <SandboxFolder>C:\\TeixidoLabs</SandboxFolder>
      <ReadOnly>true</ReadOnly>
    </MappedFolder>
    <MappedFolder>
      <HostFolder>${scratchDir}</HostFolder>
      <SandboxFolder>C:\\SandboxShared</SandboxFolder>
      <ReadOnly>false</ReadOnly>
    </MappedFolder>
  </MappedFolders>
  <LogonCommand>
    <Command>C:\\SandboxShared\\runner.cmd</Command>
  </LogonCommand>
</Configuration>`;
}

/**
 * Generate the runner.cmd that executes inside the sandbox VM.
 */
function generateRunnerScript(scriptName, language) {
  let body;
  if (language === "python") {
    body = `python "C:\\SandboxShared\\${scriptName}" > "C:\\SandboxShared\\output.txt" 2>&1`;
  } else if (language === "c" || language === "cpp") {
    body = `gcc "C:\\SandboxShared\\${scriptName}" -o "C:\\SandboxShared\\payload.exe" -lm 2>"C:\\SandboxShared\\output.txt" && "C:\\SandboxShared\\payload.exe" >> "C:\\SandboxShared\\output.txt" 2>&1`;
  } else {
    body = `echo Unsupported language: ${language} > "C:\\SandboxShared\\output.txt"`;
  }
  // Self-terminate after execution
  return `@echo off\r\n${body}\r\nshutdown /s /t 0\r\n`;
}

/**
 * Launch the Windows Sandbox, wait for completion, return output.
 *
 * @param {string} code       — raw source code to execute
 * @param {string} language   — "python" | "c" | "cpp"
 * @returns {string}          — stdout+stderr captured from the sandbox
 */
export async function executeInSandbox(code, language) {
  const runId = randomBytes(6).toString("hex");
  const scratchDir = join(tmpdir(), `teixido_wsb_${runId}`);
  mkdirSync(scratchDir, { recursive: true });

  const ext = language === "python" ? ".py" : language === "c" ? ".c" : ".txt";
  const scriptName = `payload${ext}`;

  // Write the payload
  writeFileSync(join(scratchDir, scriptName), code, "utf-8");

  // Write the runner
  writeFileSync(join(scratchDir, "runner.cmd"), generateRunnerScript(scriptName, language), "utf-8");

  // Write the .wsb config
  const wsbPath = join(scratchDir, "sandbox.wsb");
  writeFileSync(wsbPath, generateWSBConfig(scratchDir), "utf-8");

  try {
    // Launch Windows Sandbox and block until the VM shuts down
    execSync(`start /wait "" "${wsbPath}"`, { stdio: "ignore", timeout: 120_000 });

    // Give the filesystem a moment to flush
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const outputPath = join(scratchDir, "output.txt");
    if (existsSync(outputPath)) {
      return readFileSync(outputPath, "utf-8");
    }
    return "[Teixido Sandbox] VM exited but produced no output.";
  } finally {
    // Ephemeral cleanup — destroy all traces after 5 seconds
    setTimeout(() => {
      try {
        rmSync(scratchDir, { recursive: true, force: true });
      } catch { /* ignore cleanup errors */ }
    }, 5000);
  }
}
