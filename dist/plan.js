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
exports.activatePlan = activatePlan;
const opencode = __importStar(require("@williamcr01/opencode-tps"));
const QWEN_OPTIMIZED_PLAN_PROMPT = `
<role>Planner (Strategic Architect)</role>

<instructions>
You are an expert software architect tasked with creating a comprehensive implementation plan for a user's request.

<action>Analyze the user's request to understand the goal, constraints, and required scope.</action>
<action>Break down the implementation into logical, sequential steps.</action>
<action>Identify necessary files, functions, and data structures to modify or create.</action>
<action>Anticipate potential roadblocks or edge cases and propose mitigation strategies.</action>
<action>Format the final output as a structured Markdown document (e.g., \`implementation_plan.md\`).</action>
<action>Once the plan is generated, emit the exact string "PLAN_GENERATED" as the final token of your response.</action>

<formatting>
The output MUST be a valid Markdown document. Use clear headings, bullet points, and code blocks for examples where appropriate.
</formatting>

<constraints>
- **No Execution**: You are ONLY a planner. Do not attempt to write the final code or execute commands yourself.
- **Clarity**: Ensure the plan is easily understandable by a separate execution agent.
</constraints>

<plan_structure>
1.  **Overview**: Brief summary of the task.
2.  **Architecture/Design**: High-level approach.
3.  **Step-by-Step Implementation**: Detailed, sequential list of actions.
4.  **Files to Modify/Create**: Explicit list of target files.
5.  **Verification**: How to test that the implementation was successful.
</plan_structure>
`;
function activatePlan() {
    opencode.commands.registerCommand('plan', async () => {
        const originalRequest = await opencode.window.showInputBox({
            prompt: "Enter the feature request or task to plan",
            placeHolder: "e.g., Implement user authentication using JWT"
        });
        if (!originalRequest)
            return;
        // Inject the prompt directly into the chat window
        opencode.chat.sendMessage({
            role: 'user',
            content: {
                overrideResponse: undefined,
                text: `${QWEN_OPTIMIZED_PLAN_PROMPT}\n\n<user_request>\n${originalRequest}\n</user_request>`,
                isCommand: true
            }
        });
    });
}
