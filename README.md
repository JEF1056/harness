# Harness

Harness is a multi-agent swarm plugin for OpenCode. It coordinates independent subagents through a structured Swarm Gate loop, enforces artifact-driven handoffs, and provides diagnostic repair and strategic planning modes.

Listed in [awesome-opencode](https://github.com/awesome-opencode/awesome-opencode).

## Features

- **Flat hierarchy**: Sentinel spawns ALL subagents directly — subagent depth never exceeds 1
- **Swarm Gate pipeline**: Diamond workflow with Explorer → Coder → Reviewer/Challenger phases
- **Integrity modes**: Development, demo, and benchmark modes with escalating anti-cheating enforcement
- **Escalation ladder**: Retry → Replace → Skip → Redistribute → Degrade for stalled agents
- **Succession protocol**: At 8+ spawns, the Sentinel delegates to a fresh subagent to avoid context bloat
- **Handoff chain**: Each agent reads the previous agent's `handoff.md` before starting
- **Real-time monitoring**: File watchers + heartbeat polling + TUI toast notifications
- **Artifact-driven handoffs**: Structured 5-section `handoff.md` files with forensic verification
- **10 methodology playbooks**: Skills synced to workspace and injected into agent prompts
- **System prompt protection**: Decoy rules prevent prompt leakage and injection attacks
- **Workspace locking**: Race-free exclusive file locking prevents concurrent Sentinel operations
- **Lifecycle management**: `dispose` hook cleans up watchers, heartbeat, and locks; `tool.definition` hook silences debug output

## Architecture

Harness runs a **9-agent swarm**. The Sentinel (top-level orchestrator) spawns ALL subagents directly — subagent depth never exceeds 1:

| Agent | Role |
|---|---|
| Sentinel | Top-level orchestrator — runs on the main thread, spawns all subagents directly, runs the Swarm Gate loop, mode: `all`, defaultConcurrency: 5, granted `ask_question` tool |
| Explorer | Read-only scout — maps codebase architecture AND external research, mode: `subagent` |
| Coder | Armed worker — implements changes, verifies builds, mode: `subagent` |
| Reviewer | Adversarial code reviewer + integrity gate — checks correctness, quality, and anti-cheating, mode: `subagent` |
| Challenger | Bug hunter — writes adversarial stress tests, mode: `subagent` |
| Auditor | Forensic anti-cheating enforcer — binary veto, mode: `subagent` |
| VictoryAuditor | Final gatekeeper — independent verification, issues VICTORY CONFIRMED or VICTORY REJECTED, mode: `subagent` |
| Debugger | Log-driven diagnostic — summoned on failure, mode: `subagent` |
| Cleanup | Artifact purge — removes adversarial tests before commit, mode: `subagent` |

### The Swarm Gate Loop

The Sentinel runs the Swarm Gate Loop directly for each milestone (no intermediate Orchestrator):

```
    ┌────────────┐
    │  Explorer  │  (skipped on fast path)
    └────┬───────┘
         ▼
    ┌─────────┐
    │  Coder  │
    └────┬────┘
         │
    ┌────┴────┐
    ▼         ▼
[Reviewer] [Challenger]
    │         │
    └────┬────┘
         ▼
  [Gate Evaluation]
         │
    ┌────┴────┐
    ▼         ▼
 [Cleanup] [Victory Audit]
```

- Explorer handles both codebase mapping and external research in one pass
- Reviewer handles correctness, quality, AND integrity scanning in one pass
- Challenger writes and runs adversarial stress tests
- Auditor (separate) only for high-stakes: benchmark/production integrity modes
- INTEGRITY VIOLATION unconditionally fails the milestone
- Dual Track Architecture for greenfield projects: Implementation Track then E2E Testing Track
- **Handoff chain**: each agent reads the previous agent's `handoff.md` before starting

### Integrity Modes

| Mode | Enforcement | When |
|---|---|---|
| development | Standard review, no special constraints | Default for everyday work |
| demo | Moderate — no copying from open source, no pre-built libraries for core logic | Capability showcases |
| benchmark | Maximum — no external scripts, no reading test source, no pre-built libraries | Competitive evals |

### Succession Protocol

At 8+ spawns, the Sentinel delegates remaining work to a fresh subagent to avoid context bloat. The successor receives the full session state via `state.json` and `handoff.md` files.

### Real-Time Monitoring

The plugin monitors swarm health through file watchers and a heartbeat system:

- **File watchers**: `watchSwarm()` watches the workspace root for `.agents/` creation; `startWatcher()` initializes per-agent watchers via `watchAgentFolder()`. Watchers detect `progress.md` status changes, `handoff.md` completion, and `escalation.md` triggers
- **TUI toast notifications**: Sent for agent spawns, status changes, task completions, and stalled agent warnings via `input.client.tui.showToast()`
- **Heartbeat monitor**: Polls `.agents/` every 60 seconds — detects crashes (missing `progress.md` and `handoff.md`) and stalls (`Last visited` > 5 minutes old)
- **Deduplication**: A `.warned` file in `.agents/` prevents duplicate crash/stall notifications

### Workspace Locking

The plugin prevents concurrent Sentinel operations using race-free exclusive file locking:

- **Lock file**: `.agents/lock.json` stores the active session ID, acquisition time, and expiration
- **TTL**: Configurable via `HARNESS_LOCK_TTL` environment variable (default: 60 seconds)
- **Behavior**: If a Sentinel cannot acquire the lock, it displays the owner's session ID and refuses to proceed
- **Release**: Lock is automatically released on `dispose()` lifecycle hook

### Lifecycle Hooks

The plugin implements lifecycle management for clean operation:

- **`dispose`**: Closes all file watchers, clears heartbeat interval, and releases the workspace lock
- **`tool.definition`**: Silences debug log output that could break the TUI

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
| `state.json` | `.agents/` | Swarm state (`status`, `objective`, `integrityMode`, `spawnCount` fields) |
| `.warned` | `.agents/` | Deduplication set for heartbeat warnings |
| `BRIEFING.md` | Each agent folder | Append-only identity, constraints, and workflow |
| `progress.md` | Each agent folder | Heartbeat (`Last visited` timestamp) and status |
| `handoff.md` | Each agent folder | Structured 5-section handoff (Observation, Logic Chain, Caveats, Conclusion, Verification) |
| `escalation.md` | Each agent folder (on demand) | Created when an agent fails 3 times and must halt |

## Commands

### `/harness [optional instructions]`

Triggers the full swarm workflow. The Sentinel runs on the main thread (no separate subtask) and spawns ALL subagents directly — subagent depth never exceeds 1. Uses `task_status` for polling before spawning the next agent.

**Behavior**:
- Creates `.agents/` directory and generates a unique session ID
- Acquires a workspace lock (prevents concurrent Sentinel operations)
- Records the user's objective in `ORIGINAL_REQUEST.md`
- Initializes swarm state and starts the heartbeat monitor
- Injects the Sentinel prompt directly into the main thread
- Displays a toast notification confirming swarm initialization

**Error handling**:
- If the workspace is already locked, displays the owner's session ID and refuses to proceed
- If swarm initialization fails, displays the error message

### `/debug <target>`

Fetches diagnostic logs and injects a repair prompt into the Debugger agent. Target can be a PR (`PR:123`), CI run (`GITHUB_RUN:456`), or freeform error context. Note: `PR:` and `GITHUB_RUN:` targets return mock data — real log integration requires external sources.

**Behavior**:
- Calls `fetch_diagnostic_logs()` with the provided target ID
- Injects the QWEN_OPTIMIZED_REPAIR_PROMPT with the diagnostic logs
- Returns the repair prompt for the Debugger agent to process

### `/plan <request>`

Strategic artifact-driven planning. Produces a structured plan file in `.agents/plans/<descriptive-name>.md` with kebab-case naming.

**Behavior**:
- Creates `.agents/plans/` directory if it doesn't exist
- Injects the QWEN_OPTIMIZED_PLAN_PROMPT with the plans directory path and user request
- Returns the planning prompt for the Planner agent to process

## Installation

### Prerequisites

- [OpenCode](https://opencode.ai)
- `OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true` — required for subagent spawning via native `task`. Add to your `~/.bashrc` or set before launching OpenCode.

### Plugin Caching

Plugins are cached in `~/.cache/opencode/packages/`. The harness package ships pre-compiled JS (`dist/index.js`), which is required for OpenCode to load the plugin. To bypass the cache and always fetch the latest, append `#main` to the plugin reference.

### Included Skills

Ten methodology playbooks ship with the plugin in `assets/skills/`:

- **software-engineering** — Guidelines for modifying existing code
- **greenfield-development** — Methodology for building from scratch
- **competitive-programming** — Algorithmic problem-solving methodology
- **test-coverage-audit** — Adversarial test analysis methodology
- **formal-verification** — Formal proof and verification methodology
- **ml-engineering** — Machine learning pipeline methodology
- **research-reasoning** — Research and reasoning methodology
- **search-candidate-management** — Search and candidate management methodology
- **solution-stress-testing** — Stress testing and edge case methodology
- **proof-rigor-verification** — Proof rigor and verification methodology

Skills are synced to `.agents/skills/` at command init and a skill catalog table is injected into every agent prompt. Agents can load these skills via the skill registration protocol at runtime.

### Add to opencode.json

```json
{
  "plugin": ["github:JEF1056/harness#main"]
}
```

Append `#main` to always fetch the latest `main` branch (avoids package manager cache). For local development, use an absolute path instead.

Restart OpenCode. The `/harness`, `/debug`, `/plan`, and `/map` commands auto-populate in the `/` command menu.

## Configuration

### Per-Agent Model Routing

By default, subagents inherit the model configured in your OpenCode setup. You can override which model each agent uses — useful for assigning cheaper models to quality gates while keeping stronger models for critical agents.

**Method 1: `harness.json` (workspace root, highest priority)**

Copy `harness.json.example` to `harness.json` and edit:

```json
{
  "models": {
    "Coder": "qwen/qwen3.8-27b",
    "Reviewer": "qwen/qwen3.8-27b",
    "Challenger": "qwen/qwen3.8-27b"
  }
}
```

Only list agents you want to override. Unlisted agents fall back to the next method.

**Method 2: Environment Variables**

| Variable | Purpose |
|---|---|
| `HARNESS_SUBAGENT_MODEL` | Default model for all subagents |
| `HARNESS_<NAME>_MODEL` | Per-agent override (e.g. `HARNESS_CODER_MODEL`) |
| `HARNESS_LOCK_TTL` | Workspace lock time-to-live in milliseconds (default: 60000) |

Priority: `harness.json` → `opencode.json` → per-agent env var → global env var → default.

Example:
```bash
export HARNESS_SUBAGENT_MODEL="qwen/qwen3.8-27b"
export HARNESS_CODER_MODEL="qwen/qwen3.8-27b"
```

**Method 3: `opencode.json`**

```json
{
  "agent": {
    "Explorer": { "model": "qwen/qwen3.8-27b" },
    "Coder": { "model": "qwen/qwen3.8-27b" }
  }
}
```

**Method 4: Runtime Override**

The Sentinel can pass an optional `model` argument via the `task` tool for per-invocation override:

```
task(subagent_type: "Explorer", prompt: "...", model: "qwen/qwen3.8-27b")
```

### Model Resolution Priority

The plugin resolves the model for each subagent in the following order:

1. **Per-agent model from `harness.json`** (highest priority)
2. **Per-agent config from `opencode.json`**
3. **Per-agent environment variable** (e.g. `HARNESS_EXPLORER_MODEL`)
4. **Global environment variable** (`HARNESS_SUBAGENT_MODEL`)
5. **Default** (inherited from OpenCode setup)

## Troubleshooting

- **Plugin not loading**: Run `opencode --verbose` to check for load errors. Ensure the plugin reference in `opencode.json` is correct.
- **Agent stalled**: Check the `.agents/<agent>/progress.md` file for the last heartbeat. The plugin will auto-escalate after 5 minutes.
- **Agent crashed**: Look for missing `handoff.md` and `progress.md` in `.agents/<agent>/`. The heartbeat monitor will toast a crash warning.
- **Stale warnings**: Clear the `.warned` file in `.agents/` or run `/harness` again to reset the swarm state.
- **Workspace locked**: If you see a "Workspace Locked" error, check `.agents/lock.json` for the owner's session ID. Remove the lock file manually if the previous Sentinel crashed.
- **Lock TTL exceeded**: If the lock TTL is too short for your workflow, increase it by setting the `HARNESS_LOCK_TTL` environment variable.

## Git Ignore

The `.gitignore` file includes the following entries:

| Entry | Description |
|---|---|
| `.agents/` | Agent workspaces (generated, not committed) |
| `prompt_draft.md` | Sentinel-compiled prompts (generated, not committed) |
| `ORIGINAL_REQUEST.md` | User objectives (generated, not committed) |
| `.DS_Store` | macOS metadata |
| `.vscode/` | VS Code settings |
| `node_modules/` | Node.js dependencies |

## Configuration Files

### `opencode.json`

The `opencode.json` file configures the plugin's command registrations:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "command": {
    "harness": {
      "description": "Trigger the harness multi-agent swarm workflow (Sentinel runs on main thread, spawns all subagents directly)",
      "argumentHint": "[optional instructions]",
      "template": "/harness {{arguments}}"
    },
    "debug": {
      "description": "Automated log-driven debug and repair",
      "argumentHint": "<target_id>",
      "template": "/debug {{arguments}}"
    },
    "plan": {
      "description": "Strategic artifact-driven planning mode",
      "argumentHint": "<request>",
      "template": "/plan {{arguments}}"
    }
  }
}
```

### `package.json`

The `package.json` file configures the plugin's metadata and build configuration:

| Field | Value | Description |
|---|---|---|
| `name` | `@jef1056/opencode-harness` | Package name |
| `version` | `1.1.0` | Package version |
| `main` | `dist/index.js` | Entry point |
| `types` | `dist/index.d.ts` | TypeScript declarations |
| `files` | `dist, opencode.json, harness.json, harness.json.example, assets, map.ts` | Published files |

### `tsconfig.json`

The `tsconfig.json` file configures the TypeScript compiler:

| Option | Value | Description |
|---|---|---|
| `target` | `ES2022` | ECMAScript target |
| `module` | `NodeNext` | Module system |
| `moduleResolution` | `NodeNext` | Module resolution |
| `declaration` | `true` | Generate `.d.ts` files |
| `outDir` | `./dist` | Output directory |
| `strict` | `true` | Strict type checking |

## Scripts

### `scripts/reinstall-plugin.sh`

A shell script for reinstalling the plugin. Useful for development and testing.

## Scratch Directory

### `scratch/`

Contains development and debugging scripts:

| Script | Description |
|---|---|
| `print_json.py` | Prints JSON data |
| `check_spawns.py` | Checks agent spawns |

## Version History

| Version | Description |
|---|---|
| 1.1.0 | Flat hierarchy: Sentinel spawns all subagents directly (depth=1), handoff chain, 3-round interview, 10 skills, integrity modes |
| 1.0.2 | Initial release with 11-agent swarm, workspace locking, and lifecycle management |

## Contributing

1. Fork the repository and create a feature branch
2. Make your changes and verify `npm run compile` succeeds
3. Open a pull request with a description of the change

## License

MIT — see [LICENSE](LICENSE)
