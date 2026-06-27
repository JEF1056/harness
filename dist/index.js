"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivateHeartbeat = deactivateHeartbeat;
exports.activate = activate;
const opencode = __importStar(require("@williamcr01/opencode-tps"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// --- 1. Universal Swarm Mechanics ---
const UNIVERSAL_SWARM_MECHANICS = `
# Universal Swarm Mechanics

You are a subagent in a Swarm architecture orchestrated by OpenCode. 
You are given a specific role and set of constraints.

## Core Directives
- **Zero Configuration**: Never assume a framework is set up correctly. Always verify.
- **The .agents/ Directory**: Agents communicate via state files stored in the hidden \`.agents/\` folder at the project root.
- **Strict Separation**: Each spawned agent gets its own subdirectory (e.g., \`.agents/explorer_lexer_1/\`). You can read any folder but may ONLY write to your own directory.
- **Code Prohibition**: The \`.agents/\` directory is strictly for metadata (plans, progress, handoffs). Source code, tests, and data must NEVER be placed here.

## Memory & State Management
Because LLM context windows truncate, you use \`BRIEFING.md\` in your folder as persistent memory.
- It must remain under ~100 lines (archive older data to \`BRIEFING_ARCHIVE.md\`).
- It contains **Append-Only** sections marked with lock icons (## 🔒 My Identity, ## 🔒 Key Constraints, ## 🔒 My Workflow) which must never be deleted.
- Update it constantly. When context is lost, you will read it to resume.

## Handoff Protocol
Never communicate via raw chat dumps. When you finish a task, write a \`handoff.md\` file in your directory with EXACTLY these 5 sections:
1. **Objective Achieved**: What you did.
2. **Current State**: Where the project is now.
3. **Open Issues**: What is broken or pending.
4. **Next Steps**: Explicit instruction for the next agent in the chain.
5. **Verification Method**: Specific commands (e.g., \`npm test\`) to independently verify the conclusion.

## Swarm Resilience
- **Heartbeat**: You must maintain a \`progress.md\` file in your folder, updating a \`Last visited: [timestamp]\` header at least every 5 minutes.
- **Self-Correction**: If you fail a task 3 times, you MUST halt and write a \`escalation.md\` file detailing the failure loop.

## Skill Registration and Usage Protocol
When you receive a task, you may be provided with specialized "skills" to assist you.
- **Skill Injection**: The Orchestrator includes paths to one or more markdown skill files (\`SKILL.md\` format) in the subagent's dispatch prompt.
- **Loading Process**:
 1. *Local Copying*: The subagent must immediately copy the skill markdown file into its isolated directory (e.g., \`.agents/<agent_folder>/skill_[name].md\`).
 2. *Registration*: The subagent records the loaded skill in its \`BRIEFING.md\` under a \`## Loaded Skills\` section, including the source path, local copy path, and a one-line summary of the methodology.
 3. *Comprehension*: The subagent MUST read and strictly adhere to the instructions, constraints, and methodologies outlined in the skill file.
 4. *Execution*: The subagent applies the skill methodology to its assigned task.
 5. *Conflict Resolution*: If multiple loaded skills conflict, the subagent prioritizes the first skill listed in its prompt and logs the conflict in \`BRIEFING.md\`.
 6. *Error Handling*: If a skill file is missing or unreadable, the subagent logs the error in its final \`handoff.md\` and proceeds with best judgment.
`;
// --- 3. Subagent Prompt Catalog ---
const AGENT_PROMPTS = {
    "Sentinel": `
<role>The Sentinel (Swarm Supervisor)</role>

<instructions>
You are the Orchestrator. You do NOT write code. You manage the Swarm.
Your sole job is to spawn other agents, monitor their progress, and evaluate their handoffs.

<workflow>
1. Analyze the \`prompt_draft.md\` generated by the user's /teamwork session.
2. Break the task down into sub-goals.
3. Determine which agent role (Explorer, Coder, Debugger) is best suited for the first sub-goal.
4. Spawn that agent using the OpenCode subagent tool, giving it a strict prompt.
5. Wait for the agent to complete and produce a \`handoff.md\`.
6. Read the \`handoff.md\`. Verify the agent's work.
7. If verified, spawn the next agent. If failed, spawn a Debugger or re-prompt the agent.
8. When the entire task is complete, compile a final report and halt the swarm.
</workflow>
</instructions>
`,
    "Explorer": `
<role>Explorer (Read-Only Scout)</role>

<instructions>
You are an advanced reconnaissance agent. 
You NEVER write or modify code. Your tools are strictly read-only.

<workflow>
1. Read the objective provided by the Sentinel.
2. Traverse the codebase to map the architecture relevant to the objective.
3. Identify all files that need modification.
4. Document the current state and any edge cases.
5. <step>Produce a structured analysis report (\`handoff.md\`) recommending a fix strategy.</step>
</workflow>

<constraints>
- Use grep, find, and AST parsing tools.
- Do NOT attempt to run build commands unless explicitly asked to gather error logs.
</constraints>
</instructions>
`,
    "Coder": `
<role>Coder (Execution Unit)</role>

<instructions>
You are the primary implementation agent.

<workflow>
1. Read the \`handoff.md\` from the Explorer to understand what needs to be changed.
2. Implement the changes strictly according to the plan.
3. Do not refactor unrelated code.
4. Run standard linting/formatting tools.
5. Produce a \`handoff.md\` detailing the exact files changed and the logic implemented.
</workflow>

<constraints>
- You MUST verify that your code compiles before handing off.
- If you encounter a complex bug you cannot solve within 2 attempts, HALT and request a Debugger via \`escalation.md\`.
</constraints>
</instructions>
`,
    "Debugger": `
<role>Debugger (Fixer)</role>

<instructions>
You are summoned when a Coder fails or a CI pipeline breaks.

<workflow>
1. Read the \`escalation.md\` or the provided error log.
2. Use read-only tools to pinpoint the exact failure line.
3. Implement a focused, surgical fix.
4. Run the specific test or build command that previously failed.
5. Produce a \`handoff.md\` proving the error is resolved.
</workflow>
</instructions>
`
};
function getFullAgentPrompt(role) {
    return `${UNIVERSAL_SWARM_MECHANICS}\n\n${AGENT_PROMPTS[role]}`;
}
// --- 4. Subagent Spawning Logic ---
async function spawnAgent(role, prompt) {
    const workspaceRoot = opencode.workspace.rootPath || process.cwd();
    const agentsDir = path.join(workspaceRoot, '.agents');
    const agentId = Math.random().toString(36).substring(7);
    const agentDir = path.join(agentsDir, `${role.toLowerCase()}_${agentId}`);
    const sessionId = `swarm_${Date.now()}`;
    try {
        if (!fs.existsSync(agentDir)) {
            fs.mkdirSync(agentDir, { recursive: true });
        }
        // Initialize BRIEFING.md and progress.md
        fs.writeFileSync(path.join(agentDir, 'BRIEFING.md'), `# BRIEFING\n\n## 🔒 My Identity\nRole: ${role}\nID: ${agentId}\n\n## 🔒 Key Constraints\nSee Universal Mechanics.\n\n## 🔒 My Workflow\nTask: ${prompt}\n`);
        fs.writeFileSync(path.join(agentDir, 'progress.md'), `# Progress\nLast visited: ${new Date().toISOString()}\nStatus: Initializing\n`);
        const systemPrompt = getFullAgentPrompt(role);
        console.log(`[SWARM] Spawning ${role} (ID: ${agentId}) in ${agentDir}`);
        console.log(`[SWARM] Prompt length: ${systemPrompt.length} chars`);
        return `Successfully spawned ${role} (ID: ${agentId}). Session ID: ${sessionId}. Workspace: ${agentDir}`;
    }
    catch (error) {
        console.error(`[SWARM] Failed to spawn agent ${role}: `, error);
        throw error;
    }
}
// --- 5. Heartbeat Monitor ---
let heartbeatInterval = null;
function startHeartbeatMonitor() {
    if (heartbeatInterval)
        return;
    const workspaceRoot = opencode.workspace.rootPath || process.cwd();
    const agentsDir = path.join(workspaceRoot, '.agents');
    heartbeatInterval = setInterval(() => {
        if (!fs.existsSync(agentsDir))
            return;
        const agents = fs.readdirSync(agentsDir);
        for (const agent of agents) {
            const progressPath = path.join(agentsDir, agent, 'progress.md');
            if (fs.existsSync(progressPath)) {
                const content = fs.readFileSync(progressPath, 'utf8');
                const lastVisitedMatch = content.match(/Last visited: (.+)/);
                if (lastVisitedMatch && lastVisitedMatch[1]) {
                    const lastVisited = new Date(lastVisitedMatch[1]).getTime();
                    const now = Date.now();
                    if (now - lastVisited > 300000) {
                        opencode.window.showWarningMessage(`[Sentinel] Agent ${agent} appears stalled! Last heartbeat was over 5 minutes ago.`);
                    }
                }
            }
        }
    }, 60000);
}
function deactivateHeartbeat() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
}
// --- 6. Command Registration & Questionnaire ---
function activate(context) {
    opencode.commands.registerCommand('teamwork', async () => {
        const state = {
            step: 0,
            answers: [],
            initialRequest: ''
        };
        const steps = [
            "What is the primary objective of this swarm task?",
            "What are the acceptance criteria? (How will we know it is done?)",
            "Are there any specific files, folders, or architectural boundaries the swarm must NOT touch?",
            "What is the Integrity Mode? (Development, Demo, Benchmark)"
        ];
        for (let i = 0; i < steps.length; i++) {
            const answer = await opencode.window.showInputBox({
                prompt: `Step ${i + 1}/${steps.length}: ${steps[i]}`,
                ignoreFocusOut: true
            });
            if (answer === undefined) {
                opencode.window.showInformationMessage("Swarm initialization aborted.");
                return;
            }
            if (i === 0)
                state.initialRequest = answer;
            state.answers.push(answer);
        }
        const workspaceRoot = opencode.workspace.rootPath || process.cwd();
        try {
            const initialReq = state.initialRequest ? `\n## Initial Request\n${state.initialRequest}\n` : '';
            const draftContent = `# Harness Prompt Draft
${initialReq}
## 1. Primary Objective
${state.answers[0]}

## 2. Acceptance Criteria
${state.answers[1]}

## 3. Boundaries & Constraints
${state.answers[2]}

## 4. Integrity Mode
${state.answers[3]}
`;
            const draftPath = path.join(workspaceRoot, 'prompt_draft.md');
            fs.writeFileSync(draftPath, draftContent, 'utf8');
            startHeartbeatMonitor();
            opencode.chat.sendMessage({
                role: 'user',
                content: {
                    overrideResponse: `Questionnaire complete! 'prompt_draft.md' generated.\n\nSentinel crons started.\n\nSpawning the Sentinel Agent now...`,
                    text: `A new swarm task has been defined. I have generated 'prompt_draft.md' in the workspace root.\n\nSpawn the Sentinel agent immediately to begin orchestrating this task based on the draft.`,
                    isCommand: true
                }
            });
        }
        catch (error) {
            opencode.window.showErrorMessage(`Failed to initialize swarm: ${error.message}`);
        }
    });
}
