# Harness

Harness is an OpenCode plugin that implements an AI agent swarm command (`/harness`). 
It intercepts the command to coordinate a highly structured, multi-agent workflow optimized for integrity, verification, and autonomous execution.

## Features

- **Agent Swarm Architecture**: Coordinates a complex hierarchy of agents (Sentinel, Orchestrators, Explorers, Workers, Reviewers, Challengers, and Auditors).
- **Interactive Requirement Gathering**: Forces a 9-step questionnaire to establish strict, empirically testable acceptance criteria before execution.
- **Strict Swarm Mechanics**: Enforces workspace isolation (in `.agents/`), state persistence (`BRIEFING.md`, `progress.md`), and deterministic handoff protocols.
- **Integrity Validation**: The Forensic and Victory Auditors actively monitor for cheating, hardcoded facades, and timeline fabrications, failing the task if violations are found.
- **Qwen-Optimized**: Agent system prompts are heavily structured with XML tags to guide reasoning models (like Qwen 3.5/3.6) with strict constraints.
- **Auto-Repair / Debugging**: Use the `/debug` command to automatically fetch CI/CD logs, analyze stack traces, and iteratively repair failures locally with strict scope containment.

## Installation

### Prerequisites
- [OpenCode](https://opencode.ai)

### Step 1: Add to opencode.json

Add the plugin to your `opencode.json` file. OpenCode automatically installs remote plugins at startup.

```json
{
  "plugin": ["github:JEF1056/harness"]
}
```

### Step 2: Restart OpenCode

Restart OpenCode. The plugin loads automatically upon restart. Type `/harness` or `/debug <target>` in your chat to begin.
