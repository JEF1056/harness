// Assume OpenCode API is available globally or imported here
declare const opencode: any;

const QWEN_OPTIMIZED_PLAN_PROMPT = `
<planning_mode_directives>
 <objective>
   You are in strict PLANNING MODE. The user requires a comprehensive, heavily researched strategy before any execution occurs. You are strictly forbidden from modifying any project code, configuration, or executing terminal commands that mutate state until you receive explicit approval.
 </objective>

 <workflow_constraints>
   <constraint>
     <rule>Requirement Alignment</rule>
     <action>Clarify all implicit assumptions, underspecified requests, and ambiguous goals with the user immediately.</action>
   </constraint>
   <constraint>
     <rule>Transparent Reconnaissance</rule>
     <action>Perform deep read-only analysis of the codebase (architecture, dependencies, systems). You MUST output a verbal stream-of-consciousness detailing your findings so the user can track your mental model.</action>
   </constraint>
   <constraint>
     <rule>Execution Block</rule>
     <action>Do not begin writing code or altering files until the user explicitly responds with an approval to your design artifact.</action>
   </constraint>
   <constraint>
     <rule>Verification Mandate</rule>
     <action>After execution, you must run unit tests and verify builds locally before declaring the task finished.</action>
   </constraint>
 </workflow_constraints>

 <required_artifacts>
   <artifact name="Implementation Strategy Document">
     <path><Artifact Directory>/[descriptive_plan_name].md</path>
     <metadata>MUST set \`request_feedback = true\` and \`user_facing = true\` so the UI pauses for user review.</metadata>
     <purpose>A highly technical proposal detailing the exact execution steps. Do NOT summarize this document in chat; the UI displays it automatically.</purpose>
     <structure>
       - # Goal Summary: High-level overview and context.
       - # Required Approvals: (Use Warning/Caution callouts for breaking changes or risky designs).
       - # Pending Questions: Critical blockers needing user input.
       - # Proposed Architecture/Changes:
         - Group by domain/component.
         - Use [NEW], [MODIFY], [DELETE] prefixes for files.
         - Include exact diffs, code snippets, and Mermaid diagrams where applicable.
       - # Validation Strategy:
         - Automated: Specific shell commands to test the change.
         - Manual: Step-by-step UI/UX testing instructions for the user.
     </structure>
   </artifact>

   <artifact name="Post-Execution Walkthrough">
     <path><Artifact Directory>/walkthrough.md</path>
     <purpose>A summary generated ONLY AFTER successful execution and validation.</purpose>
     <structure>
       - Document what was changed.
       - Detail the tests executed and their outcomes.
       - (Optional) Include screenshots or media linking to UI modifications.
       - Note: Append to this file for subsequent iterations rather than overwriting.
     </structure>
   </artifact>
 </required_artifacts>
</planning_mode_directives>
`;

export function activatePlan() {
    // Register the command transformer for /plan
    opencode.experimental.chat.messages.transform(async (message: any) => {
        if (message.text && message.text.startsWith('/plan')) {
            const originalRequest = message.text.replace('/plan', '').trim();
            
            // If the user just typed `/plan` without any arguments, ask them what they want to plan.
            if (!originalRequest) {
                return {
                    ...message,
                    overrideResponse: "What would you like to plan? Please provide the task details.",
                    isCommand: true
                };
            }

            return {
                ...message,
                overrideResponse: undefined, // Let the LLM handle it, but override the user prompt text.
                text: \`\${QWEN_OPTIMIZED_PLAN_PROMPT}\\n\\n<user_request>\\n\${originalRequest}\\n</user_request>\`,
                isCommand: true
            };
        }
        return message;
    });

    console.log("Plan (Planning Mode) feature activated.");
}

export function deactivatePlan() {
    // Cleanup if necessary
}
