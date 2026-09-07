#!/bin/bash
echo "Injecting KaliClaw Dragon-Lobster Banner..."

NVM_NODE_PATH=$(command -v node)
NVM_LIB_DIR=$(dirname "$NVM_NODE_PATH")/../lib/node_modules/openclaw/dist

FILE_TO_PATCH=$(grep -rl "One CLI to rule them all" "$NVM_LIB_DIR" | head -n 1)

if [ -z "$FILE_TO_PATCH" ]; then
  echo "Error: Could not find the banner file in $NVM_LIB_DIR"
  exit 1
fi

node -e "
const fs = require('fs');
const file = '$FILE_TO_PATCH';
let content = fs.readFileSync(file, 'utf8');

const newBanner = \`
KaliClaw 2026.9.2 (3928bad) — One CLI to rule them all, and a Dragon-Lobster to bind them.

       /\\\\         /\\\\      ¦_¯ ¦¯¦ ¦   ¦ ¦¯¯ ¦   ¦¯¦ ¦ ¦ ¦
      /  \\\\       /  \\\\     ¦ ¦ ¦¯¦ ¦__ ¦ ¦__ ¦__ ¦¯¦ ¯_¯_¯
     / /\\\\ \\\\_____/ /\\\\ \\\\    
    / /  \\\\_     _/  \\\\ \\\\   The Dragon-Lobster Swarm
   ( (   / •   • \\\\   ) )  
    \\\\ \\\\  \\\\   ^   /  / /   
     \\\\ \\\\__\\\\_   _/__/ /    
       /           \\\\      
      /  /|     |\\\\  \\\\     
     /  / |     | \\\\  \\\\    
    /__/  |_____|  \\\\__\\\\   

\`;

content = content.replace(/OpenClaw 2026\\.[\\s\\S]*?:••••:/g, newBanner);
fs.writeFileSync(file, content);
"

echo "Banner patched successfully!"

