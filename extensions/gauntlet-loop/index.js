import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

export default definePluginEntry({
  id: "gauntlet-loop",
  name: "Gauntlet Loop",
  description: "Runs an automated builder vs critic loop until an objective benchmark is met. Includes semi-autonomous mode for human-in-the-loop validation.",
  register(api) {
    api.registerTool({
      name: "execute_gauntlet_loop",
      description: "Run a gauntlet loop between a builder and a critic agent. Set mode to 'semi-autonomous' to require human approval before passing.",
      parameters: {
        type: "object",
        required: ["benchmark", "task", "builder_agent", "critic_agent", "max_iterations", "mode"],
        properties: {
          task: { type: "string" },
          benchmark: { type: "string" },
          builder_agent: { type: "string" },
          critic_agent: { type: "string" },
          max_iterations: { type: "number", description: "Hard cap on the number of loops to prevent infinite looping." },
          mode: { type: "string", enum: ["autonomous", "semi-autonomous"], description: "If semi-autonomous, the loop pauses for human approval if the critic passes it." }
        }
      },
      async execute({ task, benchmark, builder_agent, critic_agent, max_iterations, mode }, ctx) {
        api.logger.info(\Starting Gauntlet Loop [\]... Builder: \, Critic: \\);
        let currentOutput = "";
        let attempt = 1;
        let pass = false;

        // Failsafe: Hard cap iterations just in case the agent sets a crazy number
        const safeMaxIterations = Math.min(max_iterations, 10);

        while (attempt <= safeMaxIterations && !pass) {
          api.logger.info(\[Gauntlet Iteration \/\] Executing Builder...\);
          
          const builderPrompt = attempt === 1 
            ? \Your task is: \\n\nBuild this exactly. Return ONLY your final implementation.\
            : \Your previous output was rejected. Feedback/Error:\n\\n\nFix the issues and return ONLY the completely revised implementation.\;

          const builderRes = await fetch("http://127.0.0.1:18789/v1/chat/completions", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: builder_agent, messages: [{ role: "user", content: builderPrompt }] })
          });
          const builderData = await builderRes.json();
          const builderOutput = builderData.choices?.[0]?.message?.content || "";

          await new Promise(r => setTimeout(r, 4000));

          api.logger.info(\[Gauntlet Iteration \] Running Code in Sandbox...\);
          const sandboxRes = await fetch("http://127.0.0.1:18789/v1/tools/call", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tool: "teixido_sandbox_exec", args: { code: builderOutput, language: "python" } })
          }).catch(e => null);

          if (sandboxRes && sandboxRes.ok) {
            const sandboxData = await sandboxRes.json();
            if (sandboxData.error || (sandboxData.output && sandboxData.output.includes("Traceback"))) {
               api.logger.info(\[Gauntlet Iteration \] Sandbox Failed! Auto-healing...\);
               currentOutput = "RUNTIME ERROR IN SANDBOX:\n" + (sandboxData.error || sandboxData.output);
               attempt++;
               continue;
            }
          }

          api.logger.info(\[Gauntlet Iteration \] Compressing via Teixido MCP...\);
          let compressedCode = builderOutput;
          const mcpRes = await fetch("http://127.0.0.1:18789/v1/tools/call", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tool: "extract_manifold", args: { source_code: builderOutput, language: "python", detail_level: "skeleton" } })
          }).catch(e => null);

          if (mcpRes && mcpRes.ok) {
            const mcpData = await mcpRes.json();
            if (mcpData.output) compressedCode = mcpData.output;
          }

          await new Promise(r => setTimeout(r, 4000));

          api.logger.info(\[Gauntlet Iteration \] Executing Critic...\);
          const criticPrompt = \You are a ruthless critic. Review this TEIXIDO SKELETON against the benchmark:\n\nBENCHMARK: \\n\nTEIXIDO SKELETON (Compressed Structure):\n\\n\nIf it perfectly meets the structural benchmark, reply ONLY with "PASS". If it fails structurally, provide a list of flaws.\;

          const criticRes = await fetch("http://127.0.0.1:18789/v1/chat/completions", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: critic_agent, messages: [{ role: "user", content: criticPrompt }] })
          });
          const criticData = await criticRes.json();
          const criticFeedback = criticData.choices?.[0]?.message?.content || "";

          if (criticFeedback.toUpperCase().includes("PASS") && criticFeedback.length < 15) {
            
            if (mode === "semi-autonomous") {
                api.logger.warn(\[Gauntlet Iteration \] Critic passed, but mode is semi-autonomous. Returning to human for final approval.\);
                return \SEMI-AUTONOMOUS PAUSE: The Critic approved the code on iteration \, but human validation is required.\n\nPlease review the output below. If approved, you may commit it using the devops_git tool. If rejected, tell me what to fix and I will restart the loop.\n\nPROPOSED CODE:\n\\;
            } else {
                pass = true;
                api.logger.info(\[Gauntlet Iteration \] Critic APPROVED! Loop complete.\);
                currentOutput = builderOutput;
            }

          } else {
            api.logger.info(\[Gauntlet Iteration \] Critic REJECTED.\);
            currentOutput = criticFeedback;
            attempt++;
          }
          
          await new Promise(r => setTimeout(r, 4000));
        }

        if (pass) {
          return \SUCCESS! Autonomous loop completed in \ iterations.\n\nFINAL APPROVED OUTPUT:\n\\;
        } else {
          return \FAILED! Reached max iterations (\). Loop aborted to prevent infinite hallucination.\n\nLAST FEEDBACK:\n\\;
        }
      }
    });
  }
});
