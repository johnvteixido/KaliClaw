# OpenClaw Swarm - Custom Architecture

This repository contains a highly customized, multi-agent OpenClaw Swarm setup, optimized for a Kali Linux environment. It features a persistent total recall memory engine, an automated DevOps Git workflow, and custom builder/critic orchestration loops.

## Features
- **Total Recall Engine**: Flat-file JSON ledger implementation of a memory engine (bypasses SQLite dependency issues).
- **Self-Healing Gauntlet Loop**: Automated iteration between a builder and a critic, equipped with auto-compression.
- **DevOps Git Automator**: Automatically commits verified outputs to version control.
- **Custom Agent Personas**: Fine-tuned `soul.md` logic for Researchers, Architects, and DevOps agents.

## Installation (Kali Linux)

For a streamlined installation on Kali Linux (or Ubuntu), simply run the interactive setup script.

```bash
git clone https://github.com/johnvteixido/OpenClaw-Setup.git
cd OpenClaw-Setup
chmod +x setup.sh
./setup.sh
```

### What the script does:
1. Prompts you for your API keys securely.
2. Automatically generates your `~/.openclaw/openclaw.json` configuration.
3. Installs the latest `openclaw` via npm.

## Starting the Swarm

Once installed, simply run:
```bash
openclaw gateway
```

