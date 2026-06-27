const fs = require('fs');

function fixFile(file, replacements) {
    let content = fs.readFileSync(file, 'utf8');
    for (const [bad, good] of replacements) {
        content = content.replace(bad, good);
    }
    fs.writeFileSync(file, content, 'utf8');
}

fixFile('debug.ts', [
    ['\\`;\r\n\r\nexport function activateDebug', '`;\r\n\r\nexport function activateDebug'],
    ['\\`;\n\nexport function activateDebug', '`;\n\nexport function activateDebug'],
    ['text: \\`\\${QWEN_OPTIMIZED_REPAIR_PROMPT}', 'text: `${QWEN_OPTIMIZED_REPAIR_PROMPT}'],
    ['\\n</diagnostic_target>\\n\\nBegin Phase 1: Log Analysis.\\`,', '\\n</diagnostic_target>\\n\\nBegin Phase 1: Log Analysis.`,'],
    ["return \\`[Mock Log for \\${targetId}]\\\\nError:", "return `[Mock Log for ${targetId}]\\nError:"],
    ["Action Required: Fix the type error.\\`;", "Action Required: Fix the type error.`;"],
    ["return \\`No remote logs found for '\\${targetId}'.", "return `No remote logs found for '${targetId}'."],
    ["analyze the failure.\\`;", "analyze the failure.`;"]
]);

fixFile('plan.ts', [
    ['\\`;\r\n\r\nexport function activatePlan', '`;\r\n\r\nexport function activatePlan'],
    ['\\`;\n\nexport function activatePlan', '`;\n\nexport function activatePlan'],
    ['text: \\`\\${QWEN_OPTIMIZED_PLAN_PROMPT}', 'text: `${QWEN_OPTIMIZED_PLAN_PROMPT}'],
    ['\\n</user_request>\\`,', '\\n</user_request>`,']
]);

fixFile('index.ts', [
    ['\\`;\r\n\r\n// --- 3. Subagent Prompt Catalog ---', '`;\r\n\r\n// --- 3. Subagent Prompt Catalog ---'],
    ['\\`;\n\n// --- 3. Subagent Prompt Catalog ---', '`;\n\n// --- 3. Subagent Prompt Catalog ---'],
    ['return \\`\\${UNIVERSAL_SWARM_MECHANICS}\\n\\n\\${AGENT_PROMPTS[role]}\\`;', 'return `${UNIVERSAL_SWARM_MECHANICS}\\n\\n${AGENT_PROMPTS[role]}`;'],
    ['\\`;\r\n            fs.writeFileSync', '`;\r\n            fs.writeFileSync'],
    ['\\`;\n            fs.writeFileSync', '`;\n            fs.writeFileSync'],
    ['overrideResponse: \\`Questionnaire complete!', 'overrideResponse: `Questionnaire complete!'],
    ['Spawning the Sentinel Agent now...\\`,', 'Spawning the Sentinel Agent now...`,']
]);

console.log("Specific fixes applied.");
