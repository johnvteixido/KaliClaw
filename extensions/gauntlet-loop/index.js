import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

export default definePluginEntry({
  id: "gauntlet-loop",
  name: "Gauntlet Loop",
  description: "Runs an automated builder vs critic loop until an objective benchmark is met, featuring Self-Healing and Teixido Compression.",
  register(api) {
    api.registerTool({
      name: "execute_gauntlet_loop",
      description: "Run an automated gauntlet loop between a builder and a critic agent.",
      parameters: {
        type: "object",
        required: ["benchmark", "task", "builder_agent", "critic_agent", "max_iterations"],
        properties: {
          task: { type: "string" },
          benchmark: { type: "string" },
          builder_agent: { type: "string" },
          critic_agent: { type: "string" },
          max_iterations: { type: "number" }
        }
      },
      async execute({ task, benchmark, builder_agent, critic_agent, max_iterations }, ctx) {
        api.logger.info(`Starting Gauntlet Loop... Builder: ${builder_agent}, Critic: ${critic_agent}`);
        let currentOutput = "";
        let attempt = 1;
        let pass = false;

        while (attempt <= max_iterations && !pass) {
          api.logger.info(`[Gauntlet Iteration ${attempt}] Executing Builder...`);
          
          const builderPrompt = attempt === 1 
            ? `Your task is: ${task}\n\nBuild this exactly. Return ONLY your final implementation.`
            : `Your previous output was rejected. Feedback/Error:\n${currentOutput}\n\nFix the issues and return ONLY the completely revised implementation.`;

          const builderRes = await fetch("http://127.0.0.1:18789/v1/chat/completions", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: builder_agent, messages: [{ role: "user", content: builderPrompt }] })
          });
          const builderData = await builderRes.json();
          const builderOutput = builderData.choices?.[0]?.message?.content || "";

          // Throttling to prevent free tier rate-limit (quota) errors
          await new Promise(r => setTimeout(r, 4000));

          api.logger.info(`[Gauntlet Iteration ${attempt}] Running Code in Sandbox...`);
          const sandboxRes = await fetch("http://127.0.0.1:18789/v1/tools/call", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tool: "teixido_sandbox_exec", args: { code: builderOutput, language: "python" } })
          }).catch(e => null);

          if (sandboxRes && sandboxRes.ok) {
            const sandboxData = await sandboxRes.json();
            if (sandboxData.error || (sandboxData.output && sandboxData.output.includes("Traceback"))) {
               api.logger.info(`[Gauntlet Iteration ${attempt}] Sandbox Failed! Auto-healing...`);
               currentOutput = "RUNTIME ERROR IN SANDBOX:\n" + (sandboxData.error || sandboxData.output);
               attempt++;
               continue;
            }
          }

          api.logger.info(`[Gauntlet Iteration ${attempt}] Compressing via Teixido MCP...`);
          // Compression to prevent Token Quota Limits
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

          api.logger.info(`[Gauntlet Iteration ${attempt}] Executing Critic...`);
          const criticPrompt = `You are a ruthless critic. Review this TEIXIDO SKELETON against the benchmark:\n\nBENCHMARK: ${benchmark}\n\nTEIXIDO SKELETON (Compressed Structure):\n${compressedCode}\n\nIf it perfectly meets the structural benchmark, reply ONLY with "PASS". If it fails structurally, provide a list of flaws.`;

          const criticRes = await fetch("http://127.0.0.1:18789/v1/chat/completions", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: critic_agent, messages: [{ role: "user", content: criticPrompt }] })
          });
          const criticData = await criticRes.json();
          const criticFeedback = criticData.choices?.[0]?.message?.content || "";

          if (criticFeedback.toUpperCase().includes("PASS") && criticFeedback.length < 15) {
            pass = true;
            api.logger.info(`[Gauntlet Iteration ${attempt}] Critic APPROVED!`);
            currentOutput = builderOutput;
          } else {
            api.logger.info(`[Gauntlet Iteration ${attempt}] Critic REJECTED.`);
            currentOutput = criticFeedback;
            attempt++;
          }
          
          await new Promise(r => setTimeout(r, 4000));
        }

        if (pass) {
          return `SUCCESS! Loop completed in ${attempt} iterations.\n\nFINAL APPROVED OUTPUT:\n${currentOutput}`;
        } else {
          return `FAILED! Reached max iterations.\n\nLAST FEEDBACK:\n${currentOutput}`;
        }
      }
    });
  }
});
