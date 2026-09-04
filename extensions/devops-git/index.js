import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { execSync } from "node:child_process";

export default definePluginEntry({
  id: "devops-git",
  name: "DevOps Git Interface",
  description: "Auto-commit tool for OpenClaw.",
  register(api) {
    api.registerTool({
      name: "git_auto_commit",
      description: "Initialize, add, and commit verified code to the local Git repository.",
      parameters: {
        type: "object",
        required: ["workspace_path", "commit_message"],
        properties: {
          workspace_path: { type: "string" },
          commit_message: { type: "string" }
        }
      },
      async execute({ workspace_path, commit_message }, ctx) {
        try {
          execSync('git init', { cwd: workspace_path });
          execSync('git add .', { cwd: workspace_path });
          const safeMsg = commit_message.replace(/"/g, '\\"');
          execSync(`git commit -m "${safeMsg}"`, { cwd: workspace_path });
          return `Successfully committed code in ${workspace_path}.`;
        } catch (error) {
          return `Git error: ${error.message}`;
        }
      }
    });
  }
});
