const fs = require('fs');

function fix(file, lineNum, newContent) {
    let lines = fs.readFileSync(file, 'utf8').split('\n');
    lines[lineNum - 1] = newContent + (lines[lineNum - 1].endsWith('\r') ? '\r' : '');
    fs.writeFileSync(file, lines.join('\n'), 'utf8');
}

fix('index.ts', 59, '`;');
fix('index.ts', 155, '    return `${UNIVERSAL_SWARM_MECHANICS}\\n\\n${AGENT_PROMPTS[role]}`;');
fix('index.ts', 191, '        fs.writeFileSync(path.join(agentDir, \'BRIEFING.md\'), `# BRIEFING\\n\\n## 🔒 My Identity\\nRole: ${role}\\nID: ${agentId}\\n\\n## 🔒 Key Constraints\\nSee Universal Mechanics.\\n\\n## 🔒 My Workflow\\nTask: ${prompt}\\n`);');
fix('index.ts', 192, '        fs.writeFileSync(path.join(agentDir, \'progress.md\'), `# Progress\\nLast visited: ${new Date().toISOString()}\\nStatus: Initializing\\n`);');
fix('index.ts', 208, '        return `Successfully spawned ${role} (ID: ${agentId}). Session ID: ${sessionId}. Workspace: ${agentDir}`;');
fix('index.ts', 237, '                        opencode.window.showWarningMessage(`[Sentinel] Agent ${agent} appears stalled! Last heartbeat was over 5 minutes ago.`);');
fix('index.ts', 302, '            const initialReq = (state as any).initialRequest ? `\\n## Initial Request\\n${(state as any).initialRequest}\\n` : \'\';');
fix('index.ts', 305, '            const draftContent = `# Harness Prompt Draft');
fix('index.ts', 323, '`;');
fix('index.ts', 338, '                overrideResponse: `Questionnaire complete! \'prompt_draft.md\' generated.\\n\\nSentinel crons started.\\n\\nSpawning the Sentinel Agent now...`,');

console.log("Lines perfectly fixed.");
