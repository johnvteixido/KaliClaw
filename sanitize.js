const fs = require('fs');
const path = require('path');

const SOURCE_DIR = 'C:/Users/Johnt/.openclaw';
const TARGET_DIR = 'C:/Users/Johnt/.gemini/antigravity/scratch/OpenClaw-Setup';

const filesToCopy = [
  'openclaw.json',
  'extensions/gauntlet-loop/index.js',
  'extensions/gauntlet-loop/openclaw.plugin.json',
  'extensions/total-recall-engine/index.js',
  'extensions/total-recall-engine/openclaw.plugin.json',
  'extensions/devops-git/index.js',
  'extensions/devops-git/openclaw.plugin.json',
  'agents/researcher/agent/soul.md',
  'agents/devops/agent/soul.md'
];

// Ensure directories exist
function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

for (const file of filesToCopy) {
  const src = path.join(SOURCE_DIR, file);
  const dest = path.join(TARGET_DIR, file);
  
  if (fs.existsSync(src)) {
    ensureDir(dest);
    let content = fs.readFileSync(src, 'utf8');
    
    // Sanitize Johnt paths
    content = content.replace(/C:\\\\Users\\\\Johnt\\\\/g, '<USER_HOME>\\\\');
    content = content.replace(/C:\/Users\/Johnt\//g, '<USER_HOME>/');
    content = content.replace(/Johnt/g, '<USERNAME>');
    
    // Specially sanitize openclaw.json for tokens and API keys
    if (file === 'openclaw.json') {
      try {
        const json = JSON.parse(content);
        if (json.gateway && json.gateway.auth) {
          json.gateway.auth.token = '<REDACTED_GATEWAY_TOKEN>';
        }
        if (json.agents && json.agents.defaults && json.agents.defaults.memorySearch && json.agents.defaults.memorySearch.remote) {
          json.agents.defaults.memorySearch.remote.apiKey = '<REDACTED_API_KEY>';
        }
        content = JSON.stringify(json, null, 2);
      } catch(e) {
        console.error('Error parsing openclaw.json:', e);
      }
    }
    
    fs.writeFileSync(dest, content, 'utf8');
    console.log('Copied and sanitized: ' + file);
  } else {
    console.log('File not found, skipping: ' + src);
  }
}
