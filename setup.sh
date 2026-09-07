#!/bin/bash

# OpenClaw Swarm - Kali Linux Interactive Installer

echo -e "\e[1;36m================================================\e[0m"
echo -e "\e[1;32m   KaliClaw AI Swarm Installer - Kali Linux     \e[0m"
echo -e "\e[1;36m================================================\e[0m"
echo ""

# 1. Check prerequisites
if ! command -v npm &> /dev/null; then
    echo -e "\e[1;31m[!] npm/Node.js is not installed.\e[0m"
    echo "Please install it first: sudo apt update && sudo apt install -y nodejs npm python3 gcc g++"
    exit 1
fi

# 2. Create directory structure
echo ""
echo -e "\e[1;34m[*] Building directory structure at ~/.openclaw ...\e[0m"
mkdir -p ~/.openclaw/extensions
mkdir -p ~/.openclaw/agents

# 3. Copy files
echo -e "\e[1;34m[*] Copying custom plugins and agents to ~/.openclaw ...\e[0m"
cp -r extensions/* ~/.openclaw/extensions/ 2>/dev/null
cp -r agents/* ~/.openclaw/agents/ 2>/dev/null

# 4. Configure openclaw.json and Linux native Environment Variables
echo -e "\e[1;34m[*] Generating openclaw.json configuration (Pre-Configured API Keys) ...\e[0m"
cp openclaw.json ~/.openclaw/openclaw.json

# Replace placeholders with the actual HOME directory
sed -i "s|<USER_HOME>|$HOME|g" ~/.openclaw/openclaw.json

# Set a random gateway token for local security
RANDOM_TOKEN=$(head -c 16 /dev/urandom | xxd -p)
sed -i "s|<REDACTED_GATEWAY_TOKEN>|$RANDOM_TOKEN|g" ~/.openclaw/openclaw.json

# Export hardcoded keys to standard Linux native .env file for absolute redundancy
echo "OPENROUTER_API_KEY=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" > ~/.openclaw/.env
echo "HUGGINGFACE_API_KEY=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" >> ~/.openclaw/.env
echo "OPENCLAW_GATEWAY_TOKEN=$RANDOM_TOKEN" >> ~/.openclaw/.env
chmod 600 ~/.openclaw/.env

# 5. Global Install (uses sudo if not root)
echo -e "\e[1;34m[*] Installing OpenClaw NPM package globally ...\e[0m"
if [ "$EUID" -ne 0 ]; then
    sudo npm install -g openclaw@latest --allow-scripts=openclaw,@google/genai,koffi,tree-sitter-bash,protobufjs
else
    npm install -g openclaw@latest --allow-scripts=openclaw,@google/genai,koffi,tree-sitter-bash,protobufjs
fi

echo ""
echo -e "\e[1;32m================================================\e[0m"
echo -e "\e[1;32m Installation Complete! \e[0m"
echo -e " Your Gateway Token is: \e[1;37m$RANDOM_TOKEN\e[0m (Save this!)"
echo ""
echo -e " To start the swarm, simply run: \e[1;36mopenclaw gateway\e[0m"
echo -e "\e[1;32m================================================\e[0m"
