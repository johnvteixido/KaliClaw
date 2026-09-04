#!/bin/bash

# OpenClaw Swarm - Kali Linux Interactive Installer

echo -e "\e[1;36m================================================\e[0m"
echo -e "\e[1;32m   OpenClaw AI Swarm Installer - Kali Linux     \e[0m"
echo -e "\e[1;36m================================================\e[0m"
echo ""

# 1. Check prerequisites
if ! command -v npm &> /dev/null; then
    echo -e "\e[1;31m[!] npm/Node.js is not installed.\e[0m"
    echo "Please install it first: sudo apt update && sudo apt install -y nodejs npm"
    exit 1
fi

# 2. Collect API Keys interactively
echo -e "\e[1;33m[?] Enter your OpenRouter API Key (required for agents):\e[0m"
read -p "> " OPENROUTER_KEY

echo -e "\e[1;33m[?] Enter your HuggingFace API Key (required for memory embeddings):\e[0m"
read -p "> " HF_KEY

# 3. Create directory structure
echo ""
echo -e "\e[1;34m[*] Building directory structure at ~/.openclaw ...\e[0m"
mkdir -p ~/.openclaw/extensions
mkdir -p ~/.openclaw/agents

# 4. Copy files
echo -e "\e[1;34m[*] Copying custom plugins and agents to ~/.openclaw ...\e[0m"
cp -r extensions/* ~/.openclaw/extensions/ 2>/dev/null
cp -r agents/* ~/.openclaw/agents/ 2>/dev/null

# 5. Configure openclaw.json and Linux native Environment Variables
echo -e "\e[1;34m[*] Generating openclaw.json configuration ...\e[0m"
cp openclaw.json ~/.openclaw/openclaw.json

# Replace placeholders with the actual HOME directory
sed -i "s|<USER_HOME>|$HOME|g" ~/.openclaw/openclaw.json

# Inject API keys natively into the JSON configuration
if [ ! -z "$OPENROUTER_KEY" ]; then
    sed -i "s|<REDACTED_OPENROUTER_KEY>|$OPENROUTER_KEY|g" ~/.openclaw/openclaw.json
fi

if [ ! -z "$HF_KEY" ]; then
    sed -i "s|<REDACTED_API_KEY>|$HF_KEY|g" ~/.openclaw/openclaw.json
fi

# Set a random gateway token for local security
RANDOM_TOKEN=$(head -c 16 /dev/urandom | xxd -p)
sed -i "s|<REDACTED_GATEWAY_TOKEN>|$RANDOM_TOKEN|g" ~/.openclaw/openclaw.json

# Export keys to standard Linux native .env file for absolute redundancy
echo "OPENROUTER_API_KEY=$OPENROUTER_KEY" > ~/.openclaw/.env
echo "HUGGINGFACE_API_KEY=$HF_KEY" >> ~/.openclaw/.env
echo "OPENCLAW_GATEWAY_TOKEN=$RANDOM_TOKEN" >> ~/.openclaw/.env
chmod 600 ~/.openclaw/.env

# 6. Global Install (uses sudo if not root)
echo -e "\e[1;34m[*] Installing OpenClaw NPM package globally ...\e[0m"
if [ "$EUID" -ne 0 ]; then
    sudo npm install -g openclaw@latest
else
    npm install -g openclaw@latest
fi

echo ""
echo -e "\e[1;32m================================================\e[0m"
echo -e "\e[1;32m Installation Complete! \e[0m"
echo -e " Your Gateway Token is: \e[1;37m$RANDOM_TOKEN\e[0m (Save this!)"
echo ""
echo -e " To start the swarm, simply run: \e[1;36mopenclaw gateway\e[0m"
echo -e "\e[1;32m================================================\e[0m"

