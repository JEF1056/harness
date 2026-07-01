# Harness

Harness is a powerful OpenCode plugin designed to coordinate multi-agent workflows, streamline artifact-driven planning, and automate diagnostic repairs. It achieves this by intercepting specific slash commands and driving structured, Qwen-optimized prompts.

## Features

- **8-Agent Swarm Architecture**: Sentinel (macro-supervisor), Orchestrator (dispatch-only manager), Explorer (read-only scout), Coder (armed worker), Reviewer (objective assessor), Challenger (bug hunter), Auditor (anti-cheating enforcer), VictoryAuditor (final gatekeeper).
- **Interactive Requirement Gathering**: Forces a 9-step questionnaire to establish strict, empirically testable acceptance criteria and Integrity Mode before execution.
- **Swarm Gate Iteration Loop**: Each milestone passes through Explorer → Coder → Reviewer → Challenger → Auditor. All must pass; Forensic Auditor verdict is mandatory and unconditionally fails the milestone on INTEGRITY VIOLATION.
- **Dual Track Architecture**: For greenfield projects, runs Implementation Track (builds code) then E2E Testing Track (black-box requirement-driven tests).
- **Strict Swarm Mechanics**: Enforces workspace isolation (in `.agents/`), state persistence (`BRIEFING.md`, `progress.md`), and deterministic handoff protocols (Observation → Logic Chain → Caveats → Conclusion → Verification).
- **Escalation Ladder**: Retry → Replace → Skip → Redistribute → Degrade for stalled agents.
- **System Prompt Protection**: Decoy rule prevents prompt leakage and injection attacks.
- **Serial Mode**: `/harness-serial` runs one subagent at a time — use when your server handles only one LLM request at a time.

## Commands

### 1. `/harness`
Triggers the full swarm workflow. The Sentinel runs on the main thread (no separate subtask spawned). Uses `task_nowait` + `task_status` for independent sub-goals, blocking `task` for dependent ones. Runs the full Swarm Gate loop: Explorer → Coder → Reviewer → Challenger → Auditor, then Victory Audit.

### 2. `/harness-serial`
Same swarm workflow but **strictly serial** — one subagent at a time via blocking `task`. Use when your server handles only one LLM request at a time. The Sentinel runs the full Swarm Gate loop sequentially, waiting for each subagent to complete before spawning the next.

### 3. `/debug <target>`
Triggers an iterative, automated diagnostic loop for repairing failures.
- **`<target>`**: Can be a PR number (e.g. `PR:123`), CI run ID (`GITHUB_RUN:456`), or a generic error context (`local_test_failure`).
- Enforces a 3-phase workflow: Log Analysis, Batching Strategy, Execution & Verification.

### 4. `/plan <request>`
Forces artifact-driven strategic planning before modifying code.

## Installation

### Prerequisites
- [OpenCode](https://opencode.ai)

### Step 1: Add to opencode.json

Add the plugin to your `opencode.json` file. OpenCode automatically installs remote plugins at startup.

**Important Note on Updates**: Package managers heavily cache Git repository URLs. To ensure OpenCode always fetches the latest changes from the `main` branch rather than a cached version, append `#main` to the URL. Alternatively, for local development, you can provide the absolute path to your local repository.

```json
{
  "plugin": ["github:JEF1056/harness#main"]
}
```

### Step 2: Restart OpenCode

Restart OpenCode. The plugin loads automatically upon restart. 

*Note: The `/harness`, `/debug`, and `/plan` commands are dynamically registered into OpenCode's configuration at startup via the plugin's `config` hook, so they will automatically populate in your `/` command dropdown menu!*

Type `/harness [optional instructions]`, `/debug <target>`, or `/plan <request>` in your chat to begin.

## Configuration

### Subagent Model Selection

By default, subagents use whatever model is configured in your OpenCode setup. You can override which model each subagent uses, which is useful for assigning cheaper/faster models to subagents while keeping a stronger model for the primary session.

**Method 1: Environment Variables**

| Variable | Purpose |
|---|---|
| `HARNESS_SUBAGENT_MODEL` | Default model for all subagents (Explorer, Coder, Debugger) |
| `HARNESS_EXPLORER_MODEL` | Model override for the Explorer subagent |
| `HARNESS_CODER_MODEL` | Model override for the Coder subagent |
| `HARNESS_DEBUGGER_MODEL` | Model override for the Debugger subagent |

Priority: per-agent env var → global `HARNESS_SUBAGENT_MODEL` → config file → default.

Example:
```bash
export HARNESS_SUBAGENT_MODEL="anthropic/claude-haiku-4-20250514"
export HARNESS_CODER_MODEL="anthropic/claude-sonnet-4-20250514"
```

**Method 2: opencode.json**

Set the `model` property on any subagent directly in your `opencode.json`:

```json
{
  "agent": {
    "Explorer": { "model": "anthropic/claude-haiku-4-20250514" },
    "Coder": { "model": "anthropic/claude-sonnet-4-20250514" },
    "Debugger": { "model": "anthropic/claude-sonnet-4-20250514" }
  }
}
```

**Method 3: Runtime Override via Task Tool**

The Sentinel orchestrator can pass an optional `model` argument when spawning a subagent via the `task` tool, overriding the configured model for that specific invocation:

```
task(subagent_type: "Explorer", prompt: "...", model: "anthropic/claude-haiku-4-20250514")
```
