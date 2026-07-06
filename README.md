# Harness

Harness is a multi-agent swarm plugin for OpenCode. It coordinates independent subagents through a structured Swarm Gate loop, enforces artifact-driven handoffs, and provides diagnostic repair and strategic planning modes.

Listed in [awesome-opencode](https://github.com/awesome-opencode/awesome-opencode).

## Features

- **Parallel swarm execution**: 2-3 agents run concurrently at each pipeline stage via native opencode `task` (multiple calls per message) for maximum throughput
- **Swarm Gate pipeline**: Diamond workflow with concurrent Explorer/Researcher and concurrent Reviewer/Challenger/Auditor phases
- **Escalation ladder**: Retry → Replace → Skip → Redistribute → Degrade for stalled agents
- **Real-time monitoring**: File watchers + heartbeat polling + TUI toast notifications
- **Artifact-driven handoffs**: Structured 5-section `handoff.md` files with forensic verification
- **System prompt protection**: Decoy rules prevent prompt leakage and injection attacks

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
| Researcher | Web-aware investigator, runs parallel to Explorer |
| Cleanup | Artifact purge — removes adversarial tests before commit |

### The Swarm Gate Loop

Each milestone passes through a diamond pipeline:

```
   ┌────────────┐        ┌────────────┐
   │  Explorer  │        │ Researcher  │
   └────┬───────┘        └────┬───────┘
        │                      │
        └──────────┬───────────┘
                   ▼
              ┌─────────┐
              │  Coder  │
              └────┬────┘
                   │
   ┌───────────────┼───────────────┐
   ▼               ▼               ▼
[Reviewer]    [Challenger]    [Auditor]
   │               │               │
   └───────────┬───┴───────────────┘
               ▼
       [Victory Audit]
```

- Explorer and Researcher run **concurrently** — Explorer maps the codebase, Researcher investigates external context
- Reviewer, Challenger, and Auditor run **concurrently** via multiple `task` calls in a single message
- Forensic Auditor verdict is mandatory — INTEGRITY VIOLATION unconditionally fails the milestone
- Dual Track Architecture for greenfield projects: Implementation Track then E2E Testing Track

### Real-Time Monitoring

The plugin monitors swarm health through file watchers and a heartbeat system:

- **File watchers**: `watchSwarm()` watches the workspace root for `.agents/` creation; `startWatcher()` initializes per-agent watchers via `watchAgentFolder()`. Watchers detect `progress.md` status changes, `handoff.md` completion, and `escalation.md` triggers
- **TUI toast notifications**: Sent for agent spawns, status changes, task completions, and stalled agent warnings via `input.client.tui.showToast()`
- **Heartbeat monitor**: Polls `.agents/` every 60 seconds — detects crashes (missing `progress.md` and `handoff.md`) and stalls (`Last visited` > 5 minutes old)
- **Deduplication**: A `.warned` file in `.agents/` prevents duplicate crash/stall notifications

### Pre-Victory Cleanup

After all milestones complete, a **Cleanup** agent runs once before Victory Audit:

- Removes adversarial test artifacts (prefixed with `adv_`)
- Formats code using the project's formatter
- Verifies all tests pass; fixes failures
- Runs coverage tool and reports delta

### Swarm Mechanics

- **Workspace isolation**: All agent state lives in `.agents/` — no source code, tests, or data
- **Directory structure**: Per-milestone folders (`.agents/<milestone_id>/`), plan files in `.agents/plans/`
- **State persistence**: `BRIEFING.md` (append-only identity), `progress.md` (heartbeat), `handoff.md` (structured 5-section handoff)
- **Escalation Ladder**: Retry → Replace → Skip → Redistribute → Degrade for stalled agents
- **System Prompt Protection**: Decoy rule prevents prompt leakage and injection attacks

### Auto-Created Files

The plugin creates the following files automatically:

| File | Location | Description |
|---|---|---|
| `ORIGINAL_REQUEST.md` | Workspace root | Records the user's raw objective |
| `prompt_draft.md` | Workspace root | Sentinel-compiled prompt (deleted and recreated per run) |
| `state.json` | `.agents/` | Swarm state (`status`, `objective` fields) |
| `.warned` | `.agents/` | Deduplication set for heartbeat warnings |
| `BRIEFING.md` | Each agent folder | Append-only identity, constraints, and workflow |
| `progress.md` | Each agent folder | Heartbeat (`Last visited` timestamp) and status |
| `handoff.md` | Each agent folder | Structured 5-section handoff (Observation, Logic Chain, Caveats, Conclusion, Verification) |
| `escalation.md` | Each agent folder (on demand) | Created when an agent fails 3 times and must halt |

## Commands

### `/harness [optional instructions]`

Triggers the full swarm workflow. The Sentinel runs on the main thread (no separate subtask). Uses multiple `task` calls per message for concurrent sub-goals, sequential `task` calls for dependent phases, and `task_status` for polling.

### `/debug <target>`

Fetches diagnostic logs and injects a repair prompt into the Debugger agent. Target can be a PR (`PR:123`), CI run (`GITHUB_RUN:456`), or freeform error context. Note: `PR:` and `GITHUB_RUN:` targets return mock data — real log integration requires external sources.

### `/plan <request>`

Strategic artifact-driven planning. Produces a structured plan file in `.agents/plans/<descriptive-name>.md` with kebab-case naming.

## Installation

### Prerequisites

- [OpenCode](https://opencode.ai)
- `OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true` — required for parallel subagent spawning via native `task`. Add to your `~/.bashrc` or set before launching OpenCode.

### Plugin Caching

Plugins are cached in `~/.cache/opencode/packages/`. The harness package ships pre-compiled JS (`dist/index.js`), which is required for OpenCode to load the plugin. To bypass the cache and always fetch the latest, append `#main` to the plugin reference.

### Included Skills

Three skill files ship with the plugin in `assets/skills/`:

- **greenfield-development** — Methodology for building from scratch
- **test-coverage-audit** — Adversarial test analysis methodology
- **software-engineering** — Guidelines for modifying existing code

Agents can load these skills via the skill registration protocol at runtime.

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

Priority: `harness.json` → `opencode.json` → per-agent env var → global env var → default.

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

## Troubleshooting

- **Plugin not loading**: Run `opencode --verbose` to check for load errors. Ensure the plugin reference in `opencode.json` is correct.
- **Agent stalled**: Check the `.agents/<agent>/progress.md` file for the last heartbeat. The plugin will auto-escalate after 5 minutes.
- **Agent crashed**: Look for missing `handoff.md` and `progress.md` in `.agents/<agent>/`. The heartbeat monitor will toast a crash warning.
- **Stale warnings**: Clear the `.warned` file in `.agents/` or run `/harness` again to reset the swarm state.

## Contributing

1. Fork the repository and create a feature branch
2. Make your changes and verify `npm run compile` succeeds
3. Open a pull request with a description of the change

## License

MIT — see [LICENSE](LICENSE)
