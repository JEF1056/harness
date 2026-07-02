# Harness

Harness is a multi-agent swarm plugin for OpenCode. It coordinates independent subagents through a structured Swarm Gate loop, enforces artifact-driven handoffs, and provides diagnostic repair and strategic planning modes.

## Architecture

Harness runs a **10-agent parallel swarm** orchestrated by the Sentinel:

| Agent | Role |
|---|---|
| Sentinel | Macro-supervisor — runs on the main thread, manages the swarm |
| Orchestrator | Dispatch-only manager — decomposes tasks into milestones |
| Explorer | Read-only scout — maps codebase architecture |
| Coder | Armed worker — implements changes, verifies builds |
| Reviewer | Adversarial code reviewer — checks correctness and quality |
| Challenger | Bug hunter — writes adversarial stress tests |
| Auditor | Anti-cheating enforcer — verifies authentic implementation |
| VictoryAuditor | Final gatekeeper — independent verification, issues VICTORY CONFIRMED or VICTORY REJECTED |
| Debugger | Log-driven diagnostic — summoned on failure |
| ExploreInternet | Research agent with web search capabilities |
| Cleanup | Artifact purge — removes adversarial tests before commit |

### The Swarm Gate Loop

Each milestone passes through a diamond pipeline:

```
Explorer → Coder → [Reviewer ∥ Challenger ∥ Auditor] → Cleanup → Victory Audit
```

- Reviewer, Challenger, and Auditor run **concurrently** via `task_nowait`
- Cleanup runs after quality gates to purge adversarial test artifacts
- Forensic Auditor verdict is mandatory — INTEGRITY VIOLATION unconditionally fails the milestone
- Dual Track Architecture for greenfield projects: Implementation Track then E2E Testing Track

### Swarm Mechanics

- **Workspace isolation**: All agent state lives in `.agents/` — no source code, tests, or data
- **Directory structure**: Per-milestone folders (`.agents/<milestone_id>/`), plan files in `.agents/plans/`
- **State persistence**: `BRIEFING.md` (append-only identity), `progress.md` (heartbeat), `handoff.md` (structured 5-section handoff)
- **Escalation Ladder**: Retry → Replace → Skip → Redistribute → Degrade for stalled agents
- **System Prompt Protection**: Decoy rule prevents prompt leakage and injection attacks

## Commands

### `/harness [optional instructions]`

Triggers the full swarm workflow. The Sentinel runs on the main thread (no separate subtask). Uses `task_nowait` + `task_status` for concurrent sub-goals, blocking `task` for sequential phases.

### `/debug <target>`

Automated diagnostic repair loop (3-phase: Log Analysis → Batching Strategy → Execution & Verification). Target can be a PR (`PR:123`), CI run (`GITHUB_RUN:456`), or freeform error context.

### `/plan <request>`

Strategic artifact-driven planning. Produces a structured plan file in `.agents/plans/<descriptive-name>.md` with kebab-case naming.

## Installation

### Prerequisites

- [OpenCode](https://opencode.ai)

### Add to opencode.json

```json
{
  "plugin": ["github:JEF1056/harness#main"]
}
```

Append `#main` to always fetch the latest `main` branch (avoids package manager cache). For local development, use an absolute path instead.

Restart OpenCode. The `/harness`, `/debug`, and `/plan` commands auto-populate in the `/` command menu.

## Configuration

### Per-Agent Model Routing

By default, subagents inherit the model configured in your OpenCode setup. You can override which model each agent uses — useful for assigning cheaper models to quality gates while keeping stronger models for critical agents.

**Method 1: `harness.json` (workspace root, highest priority)**

Copy `harness.json.example` to `harness.json` and edit:

```json
{
  "models": {
    "Coder": "anthropic/claude-sonnet-4-20250514",
    "Reviewer": "anthropic/claude-haiku-4-20250514",
    "Challenger": "anthropic/claude-haiku-4-20250514"
  }
}
```

Only list agents you want to override. Unlisted agents fall back to the next method.

**Method 2: Environment Variables**

| Variable | Purpose |
|---|---|
| `HARNESS_SUBAGENT_MODEL` | Default model for all subagents |
| `HARNESS_<NAME>_MODEL` | Per-agent override (e.g. `HARNESS_CODER_MODEL`) |

Priority: `harness.json` → per-agent env var → global env var → `opencode.json` → default.

Example:
```bash
export HARNESS_SUBAGENT_MODEL="anthropic/claude-haiku-4-20250514"
export HARNESS_CODER_MODEL="anthropic/claude-sonnet-4-20250514"
```

**Method 3: `opencode.json`**

```json
{
  "agent": {
    "Explorer": { "model": "anthropic/claude-haiku-4-20250514" },
    "Coder": { "model": "anthropic/claude-sonnet-4-20250514" }
  }
}
```

**Method 4: Runtime Override**

The Sentinel can pass an optional `model` argument via the `task` tool for per-invocation override:

```
task(subagent_type: "Explorer", prompt: "...", model: "anthropic/claude-haiku-4-20250514")
```
