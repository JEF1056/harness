# Harness Plugin — Implementation Plan

## 1. Overview

This document addresses nine issues with the `/harness` command plugin at `/home/jfan/harness`. The plugin implements a multi-agent swarm architecture where the Sentinel orchestrates subagents (Explorer, Coder, Reviewer, Challenger, Auditor, VictoryAuditor, Debugger, Orchestrator) through a Swarm Gate loop. The fixes span: ensuring `/plan` writes descriptive files to `.agents/plans/`, removing the serial mode, enabling true parallel execution of independent phases, fixing stalled heartbeat false positives, adding two new agent types (Explore with internet search, Cleanup), supporting dynamic per-agent model routing via config, and standardizing `.agents/` directory structure.

---

## 2. Architecture / Design

### 2.1 Current Architecture

```
Sentinel (runs in-process, injected prompt)
├── Orchestrator (per-milestone subagent)
│   ├── Explorer → Coder → Reviewer → Challenger → Auditor  (sequential loop)
│   └── Debugger (on failure)
└── VictoryAuditor (final gate)
```

The Swarm Gate loop is a diamond dependency graph: Explorer feeds Coder, then Coder feeds three independent quality gates (Reviewer, Challenger, Auditor). The Sentinel runs inline via injected prompt rather than as a subagent.

### 2.2 Target Architecture

```
Sentinel (runs in-process, injected prompt — PARALLEL ONLY)
├── Orchestrator (per-milestone subagent)
│   ├── Explorer → Coder → [Reviewer ∥ Challenger ∥ Auditor]  (fan-out parallel)
│   ├── Cleanup (before commit, removes adversarial artifacts)
│   └── Debugger (on failure)
├── ExploreInternet (optional research agent with web tools)
└── VictoryAuditor (final gate)
```

Key changes:
- **Serial mode eliminated** — only parallel mode exists
- **Reviewer/Challenger/Auditor run concurrently** after Coder completes (via `task_nowait`)
- **Cleanup agent** runs post-Auditor to purge non-essential artifacts before commit
- **ExploreInternet agent** provides web research capabilities
- **Per-agent model routing** is configurable via `harness.json`

---

## 3. Step-by-Step Implementation

### Phase 0: Fix `/plan` Command — File Writing, Naming, and Location

**Step 0.1** — Ensure `/plan` always writes a file, not just chat output
- Current: `plan.ts` instructs the LLM to "Format the final output as a structured Markdown document (e.g., \`implementation_plan.md\`)" — but this is only formatting guidance, not a file-write instruction. The LLM often outputs the plan as chat text instead of writing a file.
- Fix: Add an explicit instruction to use the `write` tool to persist the plan to disk. The prompt should say: "Write the plan to a file using the \`write\` tool. Do NOT output the plan as chat text."
- Also: The "PLAN_GENERATED" sentinel token is emitted at the end, but the file write should happen BEFORE that token.

**Step 0.2** — Descriptive file naming convention
- Current: Plans are written as `implementation_plan.md` — a generic name that provides no context about what the plan covers.
- Fix: Derive a short, descriptive filename from the user's request. The planner should generate a slug from the request topic (e.g., "fix the stalled agent issue" → `fix-stalled-agent-issue.md`; "add parallel milestone support" → `parallel-milestone-support.md`).
- Instruction addition: "Generate a concise, descriptive filename from the user's request. Use kebab-case. Keep it under 60 characters. Examples: 'fix-stalled-heartbeat.md', 'add-cleanup-agent.md', 'parallel-milestone-execution.md'."

**Step 0.3** — Plans go to `.agents/plans/`, not workspace root
- Current: Plans are written to the workspace root (e.g., `implementation_plan.md`, `prompt_draft.md`).
- Fix: All plan files should be written to `.agents/plans/` in the opencode workspace directory.
- The prompt should instruct: "Write the plan file to `.agents/plans/<descriptive-name>.md`. Create the `.agents/plans/` directory if it doesn't exist."
- Update the `command.execute.before` handler for `/plan` (line 884-891) to ensure `.agents/plans/` exists before injecting the prompt.

**Step 0.4** — Update `plan.ts` prompt
- Add the file-write instruction with the `write` tool
- Add the naming convention instruction
- Add the `.agents/plans/` path instruction
- The prompt should explicitly say to create the directory if missing

### Phase 1: Remove Serial Mode

**Step 1.1** — Remove `/harness-serial` from `opencode.json`
- Delete lines 9-12 in `opencode.json` (the `harness-serial` command block)
- Keep only `/harness`, `/plan`, `/debug`

**Step 1.2** — Remove serial branch in command handler (`index.ts:808-873`)
- In the `command.execute.before` handler, remove `isSerial` variable (line 813)
- Remove the `harness-serial` condition from the `if` check (line 808 → change to `command === "harness"`)
- Remove serial mode from `state.json` initialization (line 834: drop `mode: isSerial ? "serial" : "parallel"`)
- Remove `<current_mode>` injection differentiation (lines 852-857: drop the ternary that appends serial vs parallel instructions)
- Remove the serial-mode confirmation text from `cmdOutput.parts.push` (lines 870-871: drop the `isSerial ?` branch)

**Step 1.3** — Clean Sentinel prompt constraints
- Remove the SERIAL constraints paragraph from the Sentinel prompt (lines 132-134: "In SERIAL mode, use ONLY the blocking \`task\` tool...")
- Remove the Orchestrator's serial constraints (lines 171-174)
- Remove the `<current_mode>SERIAL</current_mode>` / `<current_mode>PARALLEL</current_mode>` tag from the injected prompt

**Step 1.4** — Clean `resolveSubagentModel` and model resolution
- No changes needed here; the model resolution logic is already correct

### Phase 2: Enable True Parallel Milestone Execution

**Step 2.1** — Rewrite Sentinel prompt Swarm Gate instructions (lines 114-129)

Change from:
```
a. Spawn Explorer → b. Spawn Coder → c. Spawn Reviewer → d. Spawn Challenger → e. Spawn Auditor → f. Evaluate
```

To:
```
a. Spawn Explorer → b. Spawn Coder → c. Spawn Reviewer, Challenger, AND Auditor concurrently via task_nowait → d. Poll task_status for all three → e. Evaluate all handoffs → f. If any fail, loop back
```

**Step 2.2** — Rewrite Orchestrator prompt Swarm Gate instructions (lines 153-168)
- Same fan-out pattern: after Coder completes, use `task_nowait` to spawn Reviewer + Challenger + Auditor simultaneously
- Instruct to poll `task_status` on all three before proceeding

**Step 2.3** — Parallel milestone spawning
- The Sentinel's Phase 2 step 4 currently reads: "For each milestone, run the Swarm Gate"
- Change to: "Identify independent milestones. Spawn sub-Orchestrators for multiple milestones concurrently via `task_nowait` where possible. Dependent milestones must use blocking `task`."

**Step 2.4** — Tool schema update
- The `task_nowait` tool's `subagent_type` enum already lists all 8 agent types — no change needed
- The `task_status` tool already supports checking arbitrary subagent sessions — no change needed

### Phase 3: Fix "Stalled" False Positives

**Step 3.1** — Add handoff.md existence check to heartbeat monitor (`index.ts:370-405`)
- After line 391 (status check), add a check: if `handoff.md` exists for the agent, skip the stalled warning
- Rationale: if an agent completed its handoff, it's not stalled — the heartbeat just wasn't updated on exit

**Step 3.2** — Resume-time timestamp refresh
- When a subagent session resumes (detected by `watchAgentFolder` seeing a `progress.md` write), verify that the `Last visited` timestamp is recent
- If the timestamp is stale AND a `handoff.md` exists, suppress the warning

**Step 3.3** — Crash detection and recovery flag
- Add a `crashed: boolean` field to each agent's `progress.md` parsing
- If an agent folder exists but has no `progress.md` or `handoff.md`, mark it as potentially crashed and show a distinct toast: "Agent may have crashed — check session"

### Phase 4: Add ExploreInternet Agent

**Step 4.1** — Add prompt to `AGENT_PROMPTS` object (after line 205)

```typescript
"ExploreInternet": `
<role>ExploreInternet — Research Agent with Web Access</role>

<instructions>
You are a research agent that investigates topics using both the codebase AND the internet.

<workflow>
1. Read the objective from the Orchestrator.
2. Search the codebase for relevant context (read-only tools: read, grep, glob).
3. If the codebase lacks sufficient context, use web search tools (search, fetch, deep_search) to research best practices, documentation, and prior art.
4. Synthesize findings from both sources.
5. Produce a structured handoff.md with recommendations, cited sources, and relevant code paths.
</workflow>

<constraints>
- Do NOT write or modify code.
- Cite sources for web-based findings.
- Prefer codebase evidence over web speculation.
</constraints>
</instructions>
`
```

**Step 4.2** — Register agent in config hook (`index.ts:689-802`)
- Add `config.agent.ExploreInternet` / `config.agent.exploreinternet` block with:
  - `mode: "subagent"`
  - `description: "Research agent with internet search capabilities."`
  - `prompt: getFullAgentPrompt("ExploreInternet")`
  - Model resolution via `resolveSubagentModel("ExploreInternet", config)`

**Step 4.3** — Add to subagent spawn permissions
- Add `"ExploreInternet": "allow"` to the `taskPerms` object (line 769)
- Add to `AGENT_PROMPTS` enum in `task` tool schema (line 536) and `task_nowait` tool schema (line 603)

**Step 4.4** — Add to `resolveSubagentModel` loop (line 708)
- Include "ExploreInternet" in the agent model resolution iteration

### Phase 5: Add Cleanup Agent

**Step 5.1** — Add prompt to `AGENT_PROMPTS` object (after line 275)

```typescript
"Cleanup": `
<role>Cleanup — Artifact Purge Agent</role>

<instructions>
You are a cleanup agent that removes non-essential artifacts before commit.

<workflow>
1. Scan for adversarial test files created by the Challenger (prefixed with "adv_").
2. Identify temporary or scratch files that are not part of the deliverable.
3. Remove adversarial tests and temporary artifacts.
4. Preserve ONLY critical functional tests required for verification.
5. Produce a handoff.md listing what was removed and why.
</workflow>

<constraints>
- Never remove source code, configuration, or critical tests.
- Adversarial tests from the Challenger are NOT required for commit.
- When in doubt, preserve the file and note it in handoff.md.
</constraints>
</instructions>
`
```

**Step 5.2** — Register agent in config hook
- Add `config.agent.Cleanup` / `config.agent.cleanup` block with model resolution

**Step 5.3** — Add to subagent spawn permissions
- Add `"Cleanup": "allow"` to `taskPerms` (line 769)
- Add to `subagent_type` enum in both `task` and `task_nowait` tool schemas

**Step 5.4** — Insert into Swarm Gate loop
- In the Sentinel and Orchestrator prompts, add Cleanup as a step between Auditor and Victory Audit
- Specifically: after step (e) Auditor, add: "Spawn a **Cleanup** agent to remove adversarial test artifacts. Read its `handoff.md`."

### Phase 6: Dynamic Agent Model Routing (Config-Driven)

**Step 6.1** — Create `harness.json` config schema

A new file at the workspace root: `harness.json`

```json
{
  "models": {
    "Sentinel": "anthropic/claude-sonnet-4-20250514",
    "Orchestrator": "anthropic/claude-sonnet-4-20250514",
    "Explorer": "anthropic/claude-haiku-4-20250514",
    "Coder": "anthropic/claude-sonnet-4-20250514",
    "Reviewer": "anthropic/claude-haiku-4-20250514",
    "Challenger": "anthropic/claude-haiku-4-20250514",
    "Auditor": "anthropic/claude-haiku-4-20250514",
    "VictoryAuditor": "anthropic/claude-sonnet-4-20250514",
    "Debugger": "anthropic/claude-haiku-4-20250514",
    "ExploreInternet": "anthropic/claude-haiku-4-20250514",
    "Cleanup": "anthropic/claude-haiku-4-20250514"
  }
}
```

**Step 6.2** — Update `resolveSubagentModel` (`index.ts:68-81`)

Change the priority chain to:
1. `harness.json` → `models.<agentName>` (NEW)
2. `opencode.json` → `config.agent.<agentName>.model` (existing)
3. Env var → `HARNESS_<NAME>_MODEL` (existing)
4. Env var → `HARNESS_SUBAGENT_MODEL` (existing)

Implementation:
- Read `harness.json` from workspace root at config time
- Add it as the first check in `resolveSubagentModel` before `config.agent[agentName].model`
- Pass the `harness.json` models object into `resolveSubagentModel`

**Step 6.3** — Add `harness.json` to `package.json` files array
- Include `"harness.json"` in the `files` array so it ships with the plugin

**Step 6.4** — Sentinel model override
- The Sentinel runs in-process (not a subagent), so its model is controlled by the main session
- The `harness.json` `Sentinel` key is aspirational — document this limitation
- For now, only subagents support dynamic model routing

### Phase 7: Standardize `.agents/` Directory Structure

**Step 7.1** — Define canonical directory structure

```
.agents/
├── state.json                          # Global workflow state
├── ORIGINAL_REQUEST.md                 # User's verbatim objective
├── prompt_draft.md                     # Approved task specification
├── plans/                              # All /plan outputs (descriptive filenames)
│   ├── fix-stalled-heartbeat.md
│   └── add-cleanup-agent.md
├── <milestone_id>/                     # Per-milestone isolation
│   ├── orchestrator/
│   │   ├── BRIEFING.md
│   │   ├── progress.md
│   │   └── handoff.md
│   ├── explorer/
│   │   ├── BRIEFING.md
│   │   ├── progress.md
│   │   └── handoff.md
│   ├── coder/
│   │   ├── BRIEFING.md
│   │   ├── progress.md
│   │   └── handoff.md
│   ├── reviewer/
│   │   └── ...
│   ├── challenger/
│   │   └── ...
│   └── auditor/
│       └── ...
├── sentinel/                           # Sentinel in-process state
│   ├── BRIEFING.md
│   └── progress.md
└── victory-auditor/                    # Final gate (separate from milestones)
    ├── BRIEFING.md
    ├── progress.md
    └── handoff.md
```

**Step 7.2** — Enforce in Universal Swarm Mechanics (`index.ts:10-60`)
- Update the `.agents/` directory description to specify the milestone-scoped structure
- Add: "Each milestone gets its own subdirectory under `.agents/<milestone_id>/` containing agent-specific folders"
- Add: "The Sentinel's state lives in `.agents/sentinel/`, not `.agents/sentinel_init/`"
- Add: "All plan files from the `/plan` command live in `.agents/plans/` with descriptive kebab-case filenames"

**Step 7.3** — Fix sentinel folder naming
- Current: `.agents/sentinel_init/` (line 839) — rename to `.agents/sentinel/`
- Update the heartbeat monitor skip condition (line 378) from `sentinel_init` to `sentinel`

**Step 7.4** — Update `startWatcher` and `watchAgentFolder` (`index.ts:471-509`)
- The watcher currently scans `.agents/` flat — update to handle the nested milestone structure
- Watch at the `.agents/` root level; the existing `fs.watch` recursive behavior will catch nested changes

### Phase 8: Build and Verify

**Step 8.1** — Rebuild
- `npm run compile` in `/home/jfan/harness`

**Step 8.2** — Verify type checking
- Confirm TypeScript compiles without errors

**Step 8.3** — Verify opencode.json is valid
- Confirm only `/harness`, `/plan`, `/debug` commands remain

---

## 4. Files to Modify/Create

| File | Action | Phases |
|------|---------|--------|
| `plan.ts` | Modify | Phase 0 |
| `opencode.json` | Modify | Phase 1 |
| `index.ts` | Modify (major) | Phases 0-7 |
| `harness.json` | Create | Phase 6 |
| `package.json` | Modify (add harness.json to files) | Phase 6 |
| `dist/index.js` | Rebuild | Phase 8 |
| `dist/index.d.ts` | Rebuild | Phase 8 |

---

## 5. Verification

### 5.0 Plan Command Fixes
- `/plan` produces a file via the `write` tool, not just chat text
- Plan files live in `.agents/plans/`, not the workspace root
- Plan filenames are descriptive (kebab-case, under 60 chars), not generic `implementation_plan.md`

### 5.1 Serial Mode Removal
- `/harness-serial` command is no longer registered
- No `isSerial` references remain in source
- Sentinel prompt contains no "SERIAL mode" text

### 5.2 Parallel Execution
- After Coder completes a milestone, Reviewer + Challenger + Auditor spawn concurrently
- Verify via `task_nowait` calls in Sentinel/Orchestrator prompt instructions
- All three handoff.md files are read before evaluation

### 5.3 Stalled Detection
- Agent with `handoff.md` present does NOT trigger a stalled warning
- Agent with stale heartbeat but no `handoff.md` still triggers warning

### 5.4 New Agents
- `ExploreInternet` appears in the `subagent_type` enum for both `task` and `task_nowait`
- `Cleanup` appears in the same enums
- Both have registered prompts in `AGENT_PROMPTS`
- Both are configured in the `config` hook

### 5.5 Dynamic Model Routing
- `harness.json` exists at workspace root
- `resolveSubagentModel` reads `harness.json` as highest priority
- Model changes in `harness.json` take effect on next plugin load

### 5.6 Directory Structure
- `.agents/sentinel/` replaces `.agents/sentinel_init/`
- Heartbeat monitor skips `sentinel` instead of `sentinel_init`
- Milestone-scoped subdirectories are created per the canonical structure
