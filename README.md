# Harness

Harness is an OpenCode plugin that implements an AI agent swarm command (`/harness`). 
It intercepts the command to coordinate a highly structured, multi-agent workflow optimized for integrity, verification, and autonomous execution.

## Features

- **Agent Swarm Architecture**: Coordinates a complex hierarchy of agents (Sentinel, Orchestrators, Explorers, Workers, Reviewers, Challengers, and Auditors).
- **Interactive Requirement Gathering**: Forces a 9-step questionnaire to establish strict, empirically testable acceptance criteria before execution.
- **Strict Swarm Mechanics**: Enforces workspace isolation (in `.agents/`), state persistence (`BRIEFING.md`, `progress.md`), and deterministic handoff protocols.
- **Integrity Validation**: The Forensic and Victory Auditors actively monitor for cheating, hardcoded facades, and timeline fabrications, failing the task if violations are found.
- **Qwen-Optimized**: Agent system prompts are heavily structured with XML tags to guide reasoning models (like Qwen 3.5/3.6) with strict constraints.

## Getting Started

1. Place the plugin source in your `.opencode/plugins/` directory.
2. Ensure it is registered in `opencode.json`:
   ```json
   {
     "plugins": [
       "./.opencode/plugins/harness.ts"
     ]
   }
   ```
3. Type `/harness` in your OpenCode chat to begin.
