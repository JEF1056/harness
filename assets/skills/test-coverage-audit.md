<skill name="test-coverage-audit">
 <description>
   Adversarial analysis of an existing test suite. Evaluates feature gaps against requirements and writes adversarial test cases to find potential hidden bugs.
 </description>

 <workflow>
   <phase id="1" name="Feature Extraction">
     Extract a comprehensive feature checklist from three perspectives:
     - Source A (Requirements): The authoritative project specification (explicit and implicit).
     - Source B (Implementation): Code analysis, looking for branches, TODO comments, and line coverage data.
     - Source C (Existing Tests): Features currently targeted by tests.
   </phase>
   <phase id="2" name="Coverage Mapping">
     Correlate tests to features. A feature is marked "Covered" only if a test would fail when that specific feature breaks. Happy-path helper usage does NOT qualify.
   </phase>
   <phase id="3" name="Gap Analysis">
     Report all gaps, assigning priority (High/Medium/Low) based on frequency of use and bug likelihood.
   </phase>
   <phase id="4" name="Adversarial Test Construction">
     Write tests designed specifically to break the code.
     - Prefix files with "adv_" to separate them.
     - Combine inputs in complex, unexpected ways (deep recursion, negative bounds, invalid state).
     - Tests must be self-verifying and deterministic.
   </phase>
   <phase id="5" name="Double Validation">
     - Run tests against a reference implementation/oracle if one exists (must pass).
     - Run tests against the target system (capturing failures to confirm bugs).
   </phase>
 </workflow>

 <output_schema>
   Write a structured markdown handoff report containing:
   - Summary counts (total features, coverage percentage, adversarial tests run/passed).
   - Merged Feature Matrix table.
   - Gap Severity table.
   - Adversarial Test Results table (showing Oracle vs. Product outcomes).
 </output_schema>
</skill>
