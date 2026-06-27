const fs = require('fs');

function fixLines(file, fixes) {
    let lines = fs.readFileSync(file, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (fixes[i + 1]) {
            lines[i] = fixes[i + 1];
        }
    }
    fs.writeFileSync(file, lines.join('\n'), 'utf8');
}

fixLines('debug.ts', {
    41: '`;\r',
    51: '                text: `${QWEN_OPTIMIZED_REPAIR_PROMPT}\\n\\n<diagnostic_target>\\n${target}\\n</diagnostic_target>\\n\\nBegin Phase 1: Log Analysis.`,\r',
    78: '                return `[Mock Log for ${targetId}]\\nError: Property \\\'foo\\\' does not exist on type \\\'Bar\\\'.\\n  at src/index.ts:42:15\\n\\nAction Required: Fix the type error.`;\r',
    82: '            return `No remote logs found for \\\'${targetId}\\\'. Please fall back to running the standard local build/test commands (e.g., \\\'npm test\\\' or \\\'npm run build\\\') and read the standard output directly to analyze the failure.`;\r'
});

fixLines('plan.ts', {
    64: '`;\r',
    80: '                text: `${QWEN_OPTIMIZED_PLAN_PROMPT}\\n\\n<user_request>\\n${originalRequest}\\n</user_request>`,\r'
});

fixLines('index.ts', {
    59: '`;\r',
    155: '    return `${UNIVERSAL_SWARM_MECHANICS}\\n\\n${AGENT_PROMPTS[role]}`;\r',
    323: '`;\r',
    338: '                overrideResponse: `Questionnaire complete! \\\'prompt_draft.md\\\' generated.\\n\\nSentinel crons started.\\n\\nSpawning the Sentinel Agent now...`,\r'
});

console.log("Lines fixed");
