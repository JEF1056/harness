<skill name="software-engineering">
 <description>
   Guidelines for modifying, extending, or refactoring existing production code. Focuses on side-effect analysis, call-tree mapping, and backward-compatible changes.
 </description>

 <workflow>
   <phase id="1" name="Codebase Assessment">
     - Locate the bug or failing test.
     - Map the call tree: identify all incoming callers and outgoing callees of the target component.
     - Read the revision history (git log/blame) to understand the context of why this code was written.
   </phase>
   <phase id="2" name="Side-Effect Mapping">
     Before modifying any line, verify:
     - Direct effects: How does the local behavior of this file change?
     - Transitive effects: Will it break any upstream callers?
     - Contract preservation: Does it violate any undocumented assumptions?
     - Dependency hygiene: Does this change introduce circular imports?
   </phase>
   <phase id="3" name="Execution Selection">
     - Single-function patch: Keep it minimal.
     - Cross-file refactor: Change targets in reverse-dependency order (bottom-up).
     - API Modification: Update all call sites first, then make the API modification.
   </phase>
 </workflow>

 <checklist>
   - [ ] Compiles cleanly without warnings.
   - [ ] Unit tests pass for all affected modules.
   - [ ] Call chain analysis confirms zero transitive regression.
   - [ ] Dependencies are cleanly declared.
   - [ ] API documentation is updated.
 </checklist>
</skill>
