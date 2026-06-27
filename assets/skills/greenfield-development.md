<skill name="greenfield-development">
 <description>
   Methodology for building new software systems, modules, or libraries from scratch. Focuses on interface-driven design, incremental integration, and self-contained testing.
 </description>

 <conventions>
   <code_layout>
     If building in a clean project, use this layout:
     - project_root/
       - src/                 # Implementation source code
         - [module]/          # Subdirectory per logical unit
           - BUILD.json       # Build file (or package.json/Makefile)
           - [module].ext     # Source code file
           - [module]_test.ext # Colocated unit tests
       - tests/               # System-wide E2E/integration tests
         - testcases/         # Test inputs/outputs
         - run_tests.sh       # Runner
       - docs/                # Architecture and design doc
   </code_layout>
 </conventions>

 <workflow>
   <phase id="0" name="Initial State Audit">
     Evaluate what exists. If the directory is empty, start from scratch. If stubs exist, verify compilation before proceeding. If partial logic exists, resume at the first incomplete function.
   </phase>
   <phase id="1" name="Interface Specification">
     Read requirements. Identify the boundary types, public functions, and dependencies. Do NOT write logic until public APIs are locked.
   </phase>
   <phase id="2" name="Scaffolding">
     Create directories, stub files with return-placeholders, and define the build targets. Compile the stubs immediately to verify dependencies.
   </phase>
   <phase id="3" name="Incremental Build">
     Implement code in small slices. Run tests alongside implementation. Do not write extensive code without testing it.
   </phase>
   <phase id="4" name="System Integration">
     Verify public signatures match the specifications. Execute all tests in dependent packages. Add regression boundary cases.
   </phase>
 </workflow>

 <checklist>
   - [ ] All public APIs conform to specifications.
   - [ ] Project compiles cleanly.
   - [ ] Local unit tests pass.
   - [ ] Edge cases (empty inputs, exceptions, boundary limits) are fully covered.
   - [ ] Stubs and placeholder code are deleted.
 </checklist>

 <anti_patterns>
   <item bad="Deferred Testing">Writing all code first and testing at the end. Leads to un-trackable bugs.</item>
   <item bad="Unilateral API Modifications">Changing shared interfaces without coordinating with the orchestrator.</item>
 </anti_patterns>
</skill>
