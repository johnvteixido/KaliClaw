import { execSync } from "node:child_process";
import { writeFileSync, readFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";

/**
 * Executes the provided code in a temporary Linux directory.
 * On Kali Linux, since it's already a VM, we use a restricted temporary
 * directory execution model with strict timeouts.
 */
export async function executeInSandbox(code, language) {
  return new Promise((resolve, reject) => {
    const runId = randomBytes(4).toString("hex");
    const scratchDir = join(tmpdir(), \	eixido_linux_\\);

    try {
      mkdirSync(scratchDir, { recursive: true });

      let scriptName, compileCmd, runCmd;

      if (language === "python") {
        scriptName = "script.py";
        runCmd = \python3 "\"\;
      } else if (language === "c" || language === "cpp") {
        scriptName = language === "c" ? "script.c" : "script.cpp";
        const compiler = language === "c" ? "gcc" : "g++";
        compileCmd = \\ "\" -o "\" -lm\;
        runCmd = \"\"\;
      } else {
        throw new Error(\Unsupported language: \\);
      }

      writeFileSync(join(scratchDir, scriptName), code, "utf-8");

      let output = "";

      if (compileCmd) {
        try {
          execSync(compileCmd, { stdio: "pipe", timeout: 15_000 });
        } catch (compileErr) {
          throw new Error(\Compilation failed:\\n\\);
        }
      }

      try {
        const result = execSync(runCmd, { stdio: "pipe", timeout: 30_000, cwd: scratchDir });
        output = result.toString();
      } catch (runErr) {
        output = (runErr.stdout?.toString() || "") + "\\n" + (runErr.stderr?.toString() || runErr.message);
      }

      resolve(output.trim() || "<No output>");
    } catch (err) {
      reject(err);
    } finally {
      try {
        rmSync(scratchDir, { recursive: true, force: true });
      } catch { /* ignore */ }
    }
  });
}
