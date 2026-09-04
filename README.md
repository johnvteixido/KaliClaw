# OpenClaw Swarm - Kali Linux Native Architecture

This repository contains a highly customized, multi-agent OpenClaw Swarm setup, explicitly rebuilt from the ground up to be **100% native to Kali Linux**. 

It features a persistent total recall memory engine, an automated DevOps Git workflow, custom builder/critic orchestration loops, and a native Linux sandbox designed specifically for penetration testing and automated security research.

## Features

- **Kali-Optimized Sandbox**: Bypasses traditional Windows Sandbox constraints. Executes agent code in native Linux `/tmp` directories with strict timeouts.
- **Pentesting Execution Allowed**: The Python/C++ AST Firewalls have been relaxed to explicitly allow `subprocess` and `os.system`. Your `Hacker` agent can natively execute Kali tools (`nmap`, `gobuster`, `msfconsole`) directly from the sandbox, while destructive host commands (like `rm -rf /`) remain blocked.
- **Secure Credential Management**: Automatically generates a `chmod 600` secured `~/.openclaw/.env` file to handle your OpenRouter and HuggingFace API keys seamlessly.
- **Native LanceDB & Total Recall**: Configured out-of-the-box with HuggingFace (`all-MiniLM-L6-v2`) embeddings mapped natively to Linux paths, plus a flat-file JSON ledger fallback.
- **DevOps Git Automator**: Automatically commits verified code outputs to version control.

## Installation

For a streamlined, one-click installation on Kali Linux (or any Debian-based distro), run the interactive setup script:

```bash
git clone https://github.com/johnvteixido/OpenClaw-Setup.git
cd OpenClaw-Setup
chmod +x setup.sh
./setup.sh
```

### What the installer does:
1. Interactively prompts you for your **OpenRouter** and **HuggingFace** API keys securely.
2. Formats all directories, `openclaw.json` mappings, and plugins strictly for Linux (`$HOME/.openclaw`).
3. Generates a secure, cryptographically random Gateway Token and `.env` file.
4. Auto-installs the latest `openclaw` globally via `npm`.

## Starting the Swarm

Once installed, simply spin up the daemon:
```bash
openclaw gateway
```
Open your browser to `http://localhost:18789` and log in with the Gateway Token provided at the end of the installation.
