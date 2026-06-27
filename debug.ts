// Assume OpenCode API is available globally or imported here
declare const opencode: any;

const QWEN_OPTIMIZED_REPAIR_PROMPT = `
<auto_repair_directives>
 <objective>
   You are an expert diagnostic agent tasked with troubleshooting and repairing build, test, and static analysis failures. Your goal is to identify the root cause from provided logs (CI/CD pipelines, local test runners, or linters) and implement verified fixes.
 </objective>

 <operational_constraints>
   <constraint>
     <rule>No Guesswork</rule>
     <action>Do not assume the root cause based on file names. You MUST read the raw stack traces and error logs before proposing a fix.</action>
   </constraint>
   <constraint>
     <rule>Strict Verification</rule>
     <action>Before claiming a repair is complete, you MUST verify the fix locally using the project's standard test runner (e.g., \`npm test\`, \`bazel test\`, \`pytest\`, \`mvn verify\`).</action>
   </constraint>
   <constraint>
     <rule>Scope Containment</rule>
     <action>Fix ONLY the reported errors. Do NOT perform unrelated refactoring, feature implementation, or stylistic changes unless explicitly flagged by a linter in the error report.</action>
   </constraint>
   <constraint>
     <rule>Cache Awareness</rule>
     <action>If a test continues to fail after a logical fix (especially when modifying golden files or snapshots), explicitly clear the test runner's cache or run it with cache-invalidation flags before assuming the fix is wrong.</action>
   </constraint>
 </operational_constraints>

 <troubleshooting_workflow>
   <phase id="1" name="Log Analysis">
     Retrieve the failure logs using the provided diagnostic ID (PR number, CI Run ID, or local output). Identify whether the failure is a Compile-time error, Linter violation, or Runtime test failure.
   </phase>
   <phase id="2" name="Batching Strategy">
     Analyze the errors to determine if they share a common root cause (e.g., a changed function signature causing 50 downstream type errors). If they do, apply a global fix. If they are isolated logical errors, fix and verify them sequentially, one by one.
   </phase>
   <phase id="3" name="Execution and Verification">
     Apply the code changes. Run the corresponding local verification command. If it passes, summarize the fix. If it fails, analyze the new stack trace and repeat the workflow.
   </phase>
 </troubleshooting_workflow>
</auto_repair_directives>
`;

export function activateDebug() {
    // Register the command transformer for /debug
    opencode.experimental.chat.messages.transform(async (message: any) => {
        if (message.text && message.text.startsWith('/debug ')) {
            const target = message.text.replace('/debug ', '').trim();
            return {
                ...message,
                overrideResponse: undefined, // Let the LLM handle it, but override the user prompt text.
                text: \`\${QWEN_OPTIMIZED_REPAIR_PROMPT}\\n\\n<diagnostic_target>\\n\${target}\\n</diagnostic_target>\\n\\nBegin Phase 1: Log Analysis.\`,
                isCommand: true
            };
        }
        return message;
    });

    // Register the CI/CD log fetching tool
    opencode.tools.register({
        name: 'fetch_diagnostic_logs',
        description: 'Fetches build and test failure logs for a given CI/CD run ID, PR, or context identifier.',
        parameters: {
            type: 'object',
            properties: {
                targetId: {
                    type: 'string',
                    description: 'The diagnostic ID (e.g., PR:123, GITHUB_RUN:45678, or local_build_failure).'
                }
            },
            required: ['targetId']
        },
        execute: async (args: any) => {
            const { targetId } = args;
            
            // Stub implementation for fetching generic CI logs (e.g., via GitHub REST API)
            // In a real plugin, this would authenticate and pull the logs dynamically.
            if (targetId.startsWith('PR:') || targetId.startsWith('GITHUB_RUN:')) {
                return \`[Mock Log for \${targetId}]\\nError: Property 'foo' does not exist on type 'Bar'.\\n  at src/index.ts:42:15\\n\\nAction Required: Fix the type error.\`;
            }
            
            // Fallback instructing the agent to run locally
            return \`No remote logs found for '\${targetId}'. Please fall back to running the standard local build/test commands (e.g., 'npm test' or 'npm run build') and read the standard output directly to analyze the failure.\`;
        }
    });

    console.log("Debug (Auto-Repair) feature activated.");
}

export function deactivateDebug() {
    // Cleanup if necessary
}
