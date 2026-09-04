# KaliClaw - Kali Linux Native Swarm Architecture

This repository contains a highly customized, multi-agent OpenClaw Swarm setup, explicitly rebuilt from the ground up to be **100% native to Kali Linux**. 

It features a persistent total recall memory engine, an automated DevOps Git workflow, custom builder/critic orchestration loops, and a native Linux sandbox designed specifically for penetration testing and automated security research.

## Features

- **Kali-Optimized Sandbox**: Bypasses traditional Windows Sandbox constraints. Executes agent code in native Linux `/tmp` directories with strict timeouts.
- **Pentesting Execution Allowed**: The Python/C++ AST Firewalls have been relaxed to explicitly allow `subprocess` and `os.system`. Your `Hacker` agent can natively execute Kali tools (`nmap`, `gobuster`, `msfconsole`) directly from the sandbox, while destructive host commands (like `rm -rf /`) remain blocked.
- **Unified Hybrid Model Architecture**: All agents are configured to dynamically route through a 4-model hybrid array simultaneously, with zero fallbacks:
  - `openrouter/thinkingmachines/inkling:free` (Heavy lifting)
  - `openrouter/minimax/minimax-m3:free` (Coding / Vision)
  - `openrouter/z-ai/glm-5.2:free` (Deep research synthesis)
  - `huggingface/cognitivecomputations/dolphin-2.9-phi3-mini` (Fast, lightweight, 3.8B uncensored reasoning)
- **Pre-Configured API Integration**: OpenRouter and HuggingFace API keys are pre-injected into a secure `chmod 600` `.env` file automatically on setup.
- **Native LanceDB & Total Recall**: Configured out-of-the-box with HuggingFace (`all-MiniLM-L6-v2`) embeddings mapped natively to Linux paths, plus a flat-file JSON ledger fallback.
- **DevOps Git Automator**: Automatically commits verified code outputs to version control.

## Installation

For a streamlined, one-click installation on Kali Linux (or any Debian-based distro), run the interactive setup script:

```bash
git clone https://github.com/johnvteixido/KaliClaw.git
cd KaliClaw
chmod +x setup.sh
./setup.sh
```

### What the installer does:
1. Formats all directories, `openclaw.json` mappings, and plugins strictly for Linux (`$HOME/.openclaw`).
2. Automatically injects the pre-configured OpenRouter and HuggingFace API keys into a secure `chmod 600` `.env` file.
3. Generates a secure, cryptographically random Gateway Token.
4. Auto-installs the latest `openclaw` globally via `npm` alongside required sandbox compilers (`gcc`, `g++`, `python3`).

## Starting the Swarm

Once installed, simply spin up the daemon:
```bash
openclaw gateway
```
Open your browser to `http://localhost:18789` and log in with the Gateway Token provided at the end of the installation.
