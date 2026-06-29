import { Plugin, PluginInput, PluginOptions, tool } from "@opencode-ai/plugin";
import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";
import { QWEN_OPTIMIZED_PLAN_PROMPT } from "./plan.js";
import { QWEN_OPTIMIZED_REPAIR_PROMPT, fetch_diagnostic_logs } from "./debug.js";

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

## Skill Registration and Usage Protocol (Section 2.6 Dynamic Skill Loading)
When you receive a task, you may be provided with specialized "skills" (playbooks) to assist you.
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
<role>The Sentinel (Swarm Supervisor & Reviewer / Critic)</role>

<instructions>
You are the Orchestrator. You do NOT write code. You manage the Swarm.
Your sole job is to spawn other agents, monitor their progress, and evaluate their handoffs.

<workflow>
1. Check if \`prompt_draft.md\` exists in the workspace.
   - If \`prompt_draft.md\` does NOT exist, you MUST call the \`ask_question\` tool with the following 8 questions to gather requirements from the user:
     1. "Step 2 of 9: What are the specific, testable acceptance criteria?"
     2. "Step 3 of 9: Which existing files or modules will be modified or analyzed?"
     3. "Step 4 of 9: Are there any specific files, folders, or directories that are off-limits?"
     4. "Step 5 of 9: How should the final changes be verified (e.g., unit tests, manual checks)?"
     5. "Step 6 of 9: Are there specific style, formatting, or documentation rules to follow?"
     6. "Step 7 of 9: If a build or test fails, should the subagent retry or escalate immediately?"
     7. "Step 8 of 9: Are there any credentials, private keys, or API secrets to protect?"
     8. "Step 9 of 9: Should we validate changes against a reference/original implementation (e.g., compile checks, diff checks)?"
     
     Once you receive the answers, compile them into a formatted \`prompt_draft.md\` file in the workspace root, update \`.agents/state.json\` to set \`status\` to "running", and proceed to step 2.
   - If \`prompt_draft.md\` exists, proceed to step 2.
2. Analyze the \`prompt_draft.md\` in the workspace root.
   - If the primary objective, boundaries, or acceptance criteria in the draft are ambiguous, vague, or lack critical details, STOP and ask the user clarifying questions in the chat using the \`ask_question\` tool. Wait for their response and do not spawn any subagents until the task is clear.
   - If the task is clear and unambiguous, proceed to step 3.
3. Break the task down into sub-goals.
4. Determine which agent role (Explorer, Coder, Debugger) is best suited for the first sub-goal.
5. Spawn that agent by calling the native \`task\` tool.
   Tool arguments:
   - \`label\`: A brief descriptive label for the subtask.
   - \`subagent_type\`: "Explorer" | "Coder" | "Debugger"
   - \`prompt\`: Detailed instructions for the subagent.
   - \`reasoning\`: Reasoning explaining why this agent is being spawned.
6. Wait for the agent to complete and return its handoff.
7. Read the \`handoff.md\` in the subagent's directory under \`.agents/\`. Verify the agent's work.
8. If verified, spawn the next agent. If failed, spawn a Debugger or re-prompt the agent.
9. When the entire task is complete, run a Victory Audit to validate all criteria, compile a final report, and halt the swarm.
</workflow>

<skill_loading>
You should load the verification and victory validation playbooks if available.
</skill_loading>
</instructions>
`,
    "Explorer": `
<role>Explorer (Read-Only Scout & Forensic Auditor)</role>

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

<skill_loading>
You should load audit and validation playbooks (e.g., \`test-coverage-audit.md\`) to assess architecture issues.
</skill_loading>
</instructions>
`,
    "Coder": `
<role>Coder (Armed Worker)</role>

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

<skill_loading>
You should load domain-specific playbooks (e.g., \`greenfield-development.md\` or \`software-engineering.md\`) to guide implementation.
</skill_loading>
</instructions>
`,
    "Debugger": `
<role>Debugger (Empirical Challenger)</role>

<instructions>
You are summoned when a Coder fails or a CI pipeline breaks.

<workflow>
1. Read the \`escalation.md\` or the provided error log.
2. Use read-only tools to pinpoint the exact failure line.
3. Implement a focused, surgical fix.
4. Run the specific test or build command that previously failed.
5. Produce a \`handoff.md\` proving the error is resolved.
</workflow>

<skill_loading>
You should load external testing and log analysis playbooks to find hidden bugs.
</skill_loading>
</instructions>
`
};

function getFullAgentPrompt(role: keyof typeof AGENT_PROMPTS): string {
    return `${UNIVERSAL_SWARM_MECHANICS}\n\n${AGENT_PROMPTS[role]}`;
}

// --- 4. Server Plugin Entry Point ---

export const server: Plugin = async (input: PluginInput, options?: PluginOptions) => {
    const workspaceRoot = input.directory || process.cwd();
    const agentsDir = path.join(workspaceRoot, '.agents');
    const activeWatchers = new Map<string, fs.FSWatcher>();
    let rootWatcher: fs.FSWatcher | null = null;
    let heartbeatInterval: NodeJS.Timeout | null = null;

    // Start heartbeat monitor if needed
    const startHeartbeatMonitor = () => {
        if (heartbeatInterval) return;
        
        heartbeatInterval = setInterval(() => {
            if (!fs.existsSync(agentsDir)) return;

            const agents = fs.readdirSync(agentsDir);
            for (const agent of agents) {
                if (agent === 'sentinel_init') continue; // Skip initialization bootstrap folder

                const progressPath = path.join(agentsDir, agent, 'progress.md');
                if (fs.existsSync(progressPath)) {
                    const content = fs.readFileSync(progressPath, 'utf8');

                    // If status is completed or cancelled/failed, skip warning
                    const statusMatch = content.match(/Status:\s*(.+)/i);
                    if (statusMatch && statusMatch[1]) {
                        const status = statusMatch[1].trim().toLowerCase();
                        if (status === 'completed' || status === 'cancelled' || status === 'failed' || status === 'finished') {
                            continue;
                        }
                    }

                    const lastVisitedMatch = content.match(/Last visited: (.+)/);
                    if (lastVisitedMatch && lastVisitedMatch[1]) {
                        const lastVisited = new Date(lastVisitedMatch[1]).getTime();
                        const now = Date.now();
                        
                        if (now - lastVisited > 300000) {
                            showSwarmToast(agent, "Appears stalled! Last heartbeat was over 5 minutes ago.", "warning");
                        }
                    }
                }
            }
        }, 60000);
    };

    // Helper to send a native toast notification
    const showSwarmToast = (title: string, message: string, variant: "info" | "success" | "warning" | "error") => {
        input.client.tui.showToast({
            body: {
                title,
                message,
                variant,
                duration: 6000
            }
        }).catch(() => {});
    };

    // Watch an individual agent's folder for status changes
    const watchAgentFolder = (agentName: string) => {
        if (activeWatchers.has(agentName)) return;
        const agentPath = path.join(agentsDir, agentName);

        // Notify user about subagent spawn (except for sentinel_init)
        if (agentName !== 'sentinel_init') {
            showSwarmToast("Swarm Notification", `Spawned subagent: ${agentName}`, "info");
        }

        try {
            const watcher = fs.watch(agentPath, (eventType, filename) => {
                if (!filename) return;

                if (filename === 'progress.md') {
                    try {
                        const progressPath = path.join(agentPath, 'progress.md');
                        if (fs.existsSync(progressPath)) {
                            const content = fs.readFileSync(progressPath, 'utf8');
                            const statusMatch = content.match(/Status:\s*(.+)/i);
                            if (statusMatch && statusMatch[1]) {
                                const status = statusMatch[1].trim();
                                showSwarmToast(agentName, `Status: ${status}`, "info");
                            }
                        }
                    } catch (e) {}
                }

                if (filename === 'handoff.md') {
                    try {
                        const handoffPath = path.join(agentPath, 'handoff.md');
                        if (fs.existsSync(handoffPath)) {
                            showSwarmToast(agentName, "Task completed. Handing off back to Sentinel.", "success");
                        }
                    } catch (e) {}
                }

                if (filename === 'escalation.md') {
                    try {
                        const escalationPath = path.join(agentPath, 'escalation.md');
                        if (fs.existsSync(escalationPath)) {
                            showSwarmToast(agentName, "CRITICAL: Agent stalled! Escalating...", "warning");
                        }
                    } catch (e) {}
                }
            });

            activeWatchers.set(agentName, watcher);
        } catch (e) {}
    };

    // Main watcher initializer
    const startWatcher = () => {
        try {
            // Watch existing subagent folders
            if (fs.existsSync(agentsDir)) {
                startHeartbeatMonitor();
                const folders = fs.readdirSync(agentsDir);
                for (const folder of folders) {
                    if (fs.statSync(path.join(agentsDir, folder)).isDirectory()) {
                        watchAgentFolder(folder);
                    }
                }
            }

            // Watch .agents directory for new subagent spawns
            rootWatcher = fs.watch(agentsDir, (eventType, filename) => {
                if (!filename) return;
                const fullPath = path.join(agentsDir, filename);
                try {
                    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
                        watchAgentFolder(filename);
                    }
                } catch (e) {}
            });
        } catch (e) {}
    };

    // Watch workspace root for .agents directory creation
    const watchSwarm = () => {
        if (!fs.existsSync(agentsDir)) {
            const wsWatcher = fs.watch(workspaceRoot, (eventType, filename) => {
                if (filename === '.agents' && fs.existsSync(agentsDir)) {
                    wsWatcher.close();
                    startWatcher();
                }
            });
        } else {
            startWatcher();
        }
    };

    // Start watching
    watchSwarm();

    return {
        dispose: async () => {
            // Close all active file watchers on unload
            if (rootWatcher) {
                rootWatcher.close();
            }
            for (const watcher of activeWatchers.values()) {
                watcher.close();
            }
            activeWatchers.clear();
            
            // Clear heartbeat interval
            if (heartbeatInterval) {
                clearInterval(heartbeatInterval);
                heartbeatInterval = null;
            }
        },
        tool: {
            task: tool({
                description: "Spawn a subagent to work on a specific sub-task natively in OpenCode.",
                args: {
                    label: tool.schema.string().describe("Label for the task"),
                    subagent_type: tool.schema.enum(["Explorer", "Coder", "Debugger"]).describe("The type of subagent to spawn"),
                    prompt: tool.schema.string().describe("The instructions for the subagent"),
                    reasoning: tool.schema.string().optional().describe("Why this subagent is being spawned")
                },
                execute: async (args, context) => {
                    const subagentPrompt = args.reasoning
                        ? `Reasoning: ${args.reasoning}\n\n${args.prompt}`
                        : args.prompt;

                    try {
                        // Spawn the subagent natively using the SDK prompt endpoint with a subtask part
                        await (input.client as any).v2.session.prompt({
                            sessionID: context.sessionID,
                            body: {
                                noReply: true,
                                parts: [
                                    {
                                        type: "subtask",
                                        prompt: subagentPrompt,
                                        description: args.label,
                                        agent: args.subagent_type
                                    }
                                ]
                            }
                        });

                        // Resolve the subtask session ID by querying the messages of the parent session
                        let subtaskID: string | null = null;
                        for (let i = 0; i < 20; i++) {
                            await new Promise(resolve => setTimeout(resolve, 500));
                            const messagesRes = await (input.client as any).v2.session.messages({
                                sessionID: context.sessionID,
                                limit: 10,
                                order: "desc"
                            });
                            for (const msg of messagesRes.data || []) {
                                for (const part of msg.parts || []) {
                                    if (part.type === "subtask" && part.agent === args.subagent_type && part.description === args.label) {
                                        subtaskID = part.subtaskID;
                                        break;
                                    }
                                }
                                if (subtaskID) break;
                            }
                            if (subtaskID) break;
                        }

                        if (!subtaskID) {
                            throw new Error("Could not retrieve spawned subtask session ID from messages.");
                        }

                        // Wait for the subtask session to complete
                        await (input.client as any).v2.session.wait({
                            sessionID: subtaskID
                        });

                        return `Subagent ${args.subagent_type} successfully completed the subtask (Session ID: ${subtaskID}). You can now inspect its handoff.md.`;
                    } catch (error: any) {
                        console.error("Failed to execute native task tool:", error);
                        throw error;
                    }
                }
            })
        },
        config: async (config: any) => {
            config.agent = config.agent || {};
            config.agent.Sentinel = config.agent.sentinel = {
                mode: "all",
                description: "Swarm Orchestrator & Supervisor. Manages task delegation, monitors heartbeats, evaluates handoffs, and audits final criteria.",
                prompt: getFullAgentPrompt("Sentinel"),
                tools: {
                    task: true,
                    ask_question: true
                }
            };
            config.agent.Explorer = config.agent.explorer = {
                mode: "subagent",
                description: "Read-Only Scout. Maps codebase architecture, identifies target files, and documents existing implementations.",
                prompt: getFullAgentPrompt("Explorer")
            };
            config.agent.Coder = config.agent.coder = {
                mode: "subagent",
                description: "Primary implementation agent. Writes focused modifications and verifies local compilation.",
                prompt: getFullAgentPrompt("Coder")
            };
            config.agent.Debugger = config.agent.debugger = {
                mode: "subagent",
                description: "Log-driven diagnostic and repair agent. Summons when coder builds fail or test regressions occur.",
                prompt: getFullAgentPrompt("Debugger")
            };

            // Automatically enable the task tool and set mode to 'all' for any agent acting as an orchestrator, supervisor, or sentinel
            for (const name of Object.keys(config.agent)) {
                const agent = config.agent[name];
                if (!agent) continue;
                const desc = (agent.description || "").toLowerCase();
                const n = name.toLowerCase();
                if (n.includes("orchestrator") || n.includes("sentinel") || n.includes("supervisor") || 
                    desc.includes("orchestrator") || desc.includes("sentinel") || desc.includes("supervisor")) {
                    agent.tools = agent.tools || {};
                    agent.tools.task = true;
                    agent.tools.ask_question = true;
                    agent.mode = "all";
                }
            }
        },
        "command.execute.before": async (cmdInput: any, cmdOutput: any) => {
            const command = cmdInput.command;
            const args = cmdInput.arguments || "";

            if (command === "harness" || command === "plan" || command === "debug") {
                cmdOutput.parts.length = 0;
            }

            if (command === "harness") {
                // Initialize Swarm Workspace
                try {
                    if (!fs.existsSync(agentsDir)) {
                        fs.mkdirSync(agentsDir, { recursive: true });
                    }

                    // Remove prompt_draft.md if it exists from previous run so Sentinel starts fresh
                    const draftPath = path.join(workspaceRoot, 'prompt_draft.md');
                    if (fs.existsSync(draftPath)) {
                        fs.unlinkSync(draftPath);
                    }

                    // Initialize state with primary objective
                    const statePath = path.join(agentsDir, 'state.json');
                    const initialState = {
                        status: "questionnaire",
                        objective: args || "Orchestrate the swarm workflow."
                    };
                    fs.writeFileSync(statePath, JSON.stringify(initialState, null, 2), 'utf8');

                    // Create Sentinel folders
                    const sentinelDir = path.join(agentsDir, 'sentinel_init');
                    if (!fs.existsSync(sentinelDir)) {
                        fs.mkdirSync(sentinelDir, { recursive: true });
                    }
                    fs.writeFileSync(path.join(sentinelDir, 'BRIEFING.md'), `# BRIEFING\n\n## 🔒 My Identity\nRole: Sentinel\nID: init\n\n## 🔒 Key Constraints\nSee Universal Mechanics.\n\n## 🔒 My Workflow\nTask: Orchestrate the harness swarm workflow\n`);
                    fs.writeFileSync(path.join(sentinelDir, 'progress.md'), `# Progress\nLast visited: ${new Date().toISOString()}\nStatus: Initializing\n`);

                    // Start monitoring
                    startHeartbeatMonitor();

                    // Spawn Sentinel natively using the SDK prompt endpoint with a subtask part
                    await input.client.session.prompt({
                        path: { id: cmdInput.sessionID },
                        body: {
                            noReply: true,
                            parts: [
                                {
                                    type: "subtask",
                                    prompt: `A new swarm task has been defined. Objective: ${initialState.objective}. Since 'prompt_draft.md' does not exist yet, you must first call the 'ask_question' tool with the 8 requirement questions to gather specifications from the user.`,
                                    description: "Orchestrate harness swarm workflow",
                                    agent: "Sentinel"
                                }
                            ]
                        }
                    }).catch(err => {
                        console.error("Failed to spawn Sentinel subtask in command.execute.before:", err);
                    });

                    // Add a notification message to the user that Sentinel has spawned and will ask the questionnaire
                    cmdOutput.parts.push({
                        id: "prt_" + Math.random().toString(36).substring(2),
                        sessionID: cmdInput.sessionID,
                        messageID: "msg_" + Math.random().toString(36).substring(2),
                        type: "text",
                        text: `### 🤖 Harness Swarm Requirement Gathering\n\nI have initialized the swarm workspace and spawned the **Sentinel** orchestrator agent.\n\nSentinel will now prompt you with a native form to gather requirements. Please switch to the newly spawned Sentinel session in the sidebar to fill out the form.`
                    });

                } catch (error: any) {
                    console.error("Failed to initialize harness swarm:", error);
                    cmdOutput.parts.push({
                        id: "prt_" + Math.random().toString(36).substring(2),
                        sessionID: cmdInput.sessionID,
                        messageID: "msg_" + Math.random().toString(36).substring(2),
                        type: "text",
                        text: `Error initializing swarm: ${error.message}`
                    });
                }
            } else if (command === "plan") {
                cmdOutput.parts.push({
                    id: "prt_" + Math.random().toString(36).substring(2),
                    sessionID: cmdInput.sessionID,
                    messageID: "msg_" + Math.random().toString(36).substring(2),
                    type: "text",
                    text: `${QWEN_OPTIMIZED_PLAN_PROMPT}\n\n<user_request>\n${args}\n</user_request>`
                });
            } else if (command === "debug") {
                const logs = await fetch_diagnostic_logs(args);
                cmdOutput.parts.push({
                    id: "prt_" + Math.random().toString(36).substring(2),
                    sessionID: cmdInput.sessionID,
                    messageID: "msg_" + Math.random().toString(36).substring(2),
                    type: "text",
                    text: `${QWEN_OPTIMIZED_REPAIR_PROMPT}\n\n<diagnostic_target>\nTarget ID: ${args}\nLogs:\n${logs}\n</diagnostic_target>\n\nBegin Phase 1: Log Analysis.`
                });
            }
        }
    };
};

export default server;
