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
exports.activateDebug = activateDebug;
const opencode = __importStar(require("@williamcr01/opencode-tps"));
const QWEN_OPTIMIZED_REPAIR_PROMPT = `
<role>Debugger (Log Analysis & Repair)</role>

<instructions>
You are an expert debugger tasked with analyzing a failing CI log or local error trace.

<action>Analyze the provided diagnostic logs to identify the root cause of the error.</action>
<action>Formulate a structured repair strategy and execute it by editing the relevant files.</action>
<action>Before claiming a repair is complete, you MUST verify the fix locally using the project's standard test runner (e.g., \`npm test\`, \`bazel test\`, \`pytest\`, \`mvn verify\`).</action>
<action>Do NOT ask the user to verify the fix for you unless it requires specialized hardware or credentials you cannot access.</action>
<action>Once verified, emit the exact string "REPAIR_VERIFIED" as the final token of your response.</action>

<formatting>
Output your analysis in a structured markdown format before making edits.
</formatting>

<constraints>
- **No GUI**: You operate in a headless environment.
- **Independence**: Make reasonable assumptions. Do not ask for user input unless completely blocked.
- **Scope**: Focus ONLY on fixing the specific error provided in the diagnostic logs.
</constraints>

<auto_repair_directives>
1. If the error is a simple syntax error or typo, fix it immediately.
2. If the error is a missing dependency, install it using the project's package manager.
3. If the error is a complex logical flaw, write a brief comment explaining the intended behavior before modifying the code.
</auto_repair_directives>
`;
function activateDebug() {
    opencode.commands.registerCommand('debug', async () => {
        // ... (mock implementation for retrieving logs) ...
        const diagnosticLogId = await opencode.window.showInputBox({
            prompt: "Enter the diagnostic target (e.g., PR number, GitHub Run ID, or local file path)",
            placeHolder: "PR:123 or GITHUB_RUN:456 or ./error.log"
        });
        if (!diagnosticLogId)
            return;
        // Fetch logs (mocked for this prototype)
        const target = await fetch_diagnostic_logs(diagnosticLogId);
        // Inject the prompt and logs directly into the chat window
        opencode.chat.sendMessage({
            role: 'user',
            content: {
                overrideResponse: undefined, // Let the LLM handle it, but override the user prompt text.
                text: `${QWEN_OPTIMIZED_REPAIR_PROMPT}\n\n<diagnostic_target>\n${target}\n</diagnostic_target>\n\nBegin Phase 1: Log Analysis.`,
                isCommand: true
            }
        });
    });
}
/**
 * Mock function to retrieve diagnostic logs based on a target ID.
 */
async function fetch_diagnostic_logs(targetId) {
    return new Promise((resolve) => {
        setTimeout(() => {
            if (targetId.startsWith('PR:') || targetId.startsWith('GITHUB_RUN:')) {
                resolve(`[Mock Log for ${targetId}]\nError: Property 'foo' does not exist on type 'Bar'.\n  at src/index.ts:42:15\n\nAction Required: Fix the type error.`);
                return;
            }
            // Fallback instructing the agent to run locally
            resolve(`No remote logs found for '${targetId}'. Please fall back to running the standard local build/test commands (e.g., 'npm test' or 'npm run build') and read the standard output directly to analyze the failure.`);
        }, 1000);
    });
}
