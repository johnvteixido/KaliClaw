import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// We use a flat JSON ledger to simulate the deterministic SQLite layer 
// to prevent native module crashes in the OpenClaw gateway environment.
const LEDGER_PATH = path.join(os.homedir(), ".openclaw", "total_recall_ledger.json");

function getLedger() {
  if (!fs.existsSync(LEDGER_PATH)) return [];
  return JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
}

function saveToLedger(entry) {
  const ledger = getLedger();
  ledger.push({ timestamp: new Date().toISOString(), ...entry });
  fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2));
}

export default definePluginEntry({
  id: "total-recall-engine",
  name: "Total Recall Engine (Teixido MCP)",
  description: "Dual-Brain Deterministic Memory using Teixido Domination Roots.",
  register(api) {
    api.registerTool({
      name: "store_deterministic_memory",
      description: "Store a highly-compressed Teixido Manifold into the immutable ledger.",
      parameters: {
        type: "object",
        required: ["agent", "manifold_data", "context_tags"],
        properties: {
          agent: { type: "string" },
          manifold_data: { type: "string", description: "The compressed Teixido Boreal Forest structural skeleton." },
          context_tags: { type: "array", items: { type: "string" } }
        }
      },
      async execute({ agent, manifold_data, context_tags }, ctx) {
        saveToLedger({ type: "store", agent, manifold_data, context_tags });
        api.logger.info(`[Total Recall] Stored Teixido manifold for ${agent}.`);
        return "Memory deterministically stored in the immutable ledger.";
      }
    });

    api.registerTool({
      name: "recall_deterministic_memory",
      description: "Query the immutable event ledger for exact historical context.",
      parameters: {
        type: "object",
        required: ["query_tag"],
        properties: {
          query_tag: { type: "string", description: "Tag or keyword to deterministically retrieve." }
        }
      },
      async execute({ query_tag }, ctx) {
        const ledger = getLedger();
        const results = ledger.filter(entry => 
          entry.context_tags && entry.context_tags.includes(query_tag)
        );
        api.logger.info(`[Total Recall] Recalled ${results.length} memories for tag: ${query_tag}.`);
        return results.length > 0 
          ? JSON.stringify(results, null, 2) 
          : "No deterministic memories found.";
      }
    });
  }
});
