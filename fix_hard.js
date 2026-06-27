const fs = require('fs');

function fix(file, lineNum, newContent) {
    let lines = fs.readFileSync(file, 'utf8').split('\n');
    lines[lineNum - 1] = newContent.replace(/\r$/, '') + (lines[lineNum - 1].endsWith('\r') ? '\r' : '');
    fs.writeFileSync(file, lines.join('\n'), 'utf8');
}

fix('debug.ts', 41, '`;');
fix('debug.ts', 51, '                text: `${QWEN_OPTIMIZED_REPAIR_PROMPT}\\n\\n<diagnostic_target>\\n${target}\\n</diagnostic_target>\\n\\nBegin Phase 1: Log Analysis.`,');
fix('debug.ts', 78, '                return `[Mock Log for ${targetId}]\\nError: Property \\\'foo\\\' does not exist on type \\\'Bar\\\'.\\n  at src/index.ts:42:15\\n\\nAction Required: Fix the type error.`;');
fix('debug.ts', 82, '            return `No remote logs found for \\\'${targetId}\\\'. Please fall back to running the standard local build/test commands (e.g., \\\'npm test\\\' or \\\'npm run build\\\') and read the standard output directly to analyze the failure.`;');

fix('plan.ts', 64, '`;');
fix('plan.ts', 80, '                text: `${QWEN_OPTIMIZED_PLAN_PROMPT}\\n\\n<user_request>\\n${originalRequest}\\n</user_request>`,');

fix('index.ts', 59, '`;');
fix('index.ts', 155, '    return `${UNIVERSAL_SWARM_MECHANICS}\\n\\n${AGENT_PROMPTS[role]}`;');
fix('index.ts', 191, '        fs.writeFileSync(path.join(agentDir, \\\'BRIEFING.md\\\'), `# BRIEFING\\n\\n## 🔒 My Identity\\nRole: ${role}\\nID: ${agentId}\\n\\n## 🔒 Key Constraints\\nSee Universal Mechanics.\\n\\n## 🔒 My Workflow\\nTask: ${prompt}\\n`);');
fix('index.ts', 192, '        fs.writeFileSync(path.join(agentDir, \\\'progress.md\\\'), `# Progress\\nLast visited: ${new Date().toISOString()}\\nStatus: Initializing\\n`);');
fix('index.ts', 208, '        return `Successfully spawned ${role} (ID: ${agentId}). Session ID: ${sessionId}. Workspace: ${agentDir}`;');
fix('index.ts', 237, '                        opencode.window.showWarningMessage(`[Sentinel] Agent ${agent} appears stalled! Last heartbeat was over 5 minutes ago.`);');
fix('index.ts', 302, '            const initialReq = (state as any).initialRequest ? `\\n## Initial Request\\n${(state as any).initialRequest}\\n` : \\\'\\\';');
fix('index.ts', 305, '            const draftContent = `# Harness Prompt Draft');
fix('index.ts', 323, '`;');
fix('index.ts', 338, '                overrideResponse: `Questionnaire complete! \\\'prompt_draft.md\\\' generated.\\n\\nSentinel crons started.\\n\\nSpawning the Sentinel Agent now...`,');

console.log("Lines hard-fixed.");
