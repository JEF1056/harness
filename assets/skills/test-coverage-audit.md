---
name: test-coverage-audit
description: Adversarial analysis of an existing test suite. Evaluates feature gaps against requirements and writes adversarial test cases to find potential hidden bugs. Use when auditing test coverage, finding untested features, or constructing adversarial test cases against an implementation.
use_for: Auditing test coverage, finding gaps between requirements and tests, writing adversarial tests to find hidden bugs.
dont_use_for: Writing a brand new test suite from scratch with no existing tests to audit (use greenfield-development testing strategy instead).
---

# Test Coverage Audit Playbook

## Workflow

### Phase 1: Feature Extraction
Extract a comprehensive feature checklist from three perspectives:

- **Source A (Requirements)**: The authoritative project specification (explicit and implicit requirements).
- **Source B (Implementation)**: Code analysis, looking for branches, error paths, TODO comments, and branch coverage data.
- **Source C (Existing Tests)**: Features currently targeted by tests.

### Phase 2: Coverage Mapping
Correlate tests to features. A feature is marked "Covered" only if a test would fail when that specific feature breaks. Happy-path helper usage does NOT qualify.

### Phase 3: Gap Analysis
Report all gaps, assigning priority (High/Medium/Llow) based on frequency of use and bug likelihood.

### Phase 4: Adversarial Test Construction
Write tests designed specifically to break the code.

- Prefix files with "adv_" to separate them.
- Combine inputs in complex, unexpected ways (deep recursion, negative bounds, invalid state).
- Tests must be self-verifying and deterministic.

### Phase 5: Double Validation
- Run tests against a reference implementation/oracle if one exists (must pass).
- Run tests against the target system (capturing failures to confirm bugs).

## Output Schema

Write a structured markdown handoff report containing:

- Summary counts (total features, coverage percentage, adversarial tests run/passed).
- Merged Feature Matrix table.
- Gap Severity table.
- Adversarial Test Results table (showing Oracle vs. Product outcomes).
