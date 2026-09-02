---
name: solution-stress-testing
description: Methodology for verifying solution correctness before submission. Covers counterexample generation, edge-case mining, input perturbation, and oracle-based differential testing. Use when verifying a solution is correct before final submission or handoff.
use_for: Verifying solution correctness before submission, counterexample generation, edge-case mining.
dont_use_for: Initial solution construction (use the relevant domain playbook first, then stress-test the result).
---

# Solution Stress Testing Playbook

## Core Principle
A solution is not correct until it has survived attempts to break it. The goal is to find the input that makes the solution wrong, not to confirm it is right.

## Workflow

### Phase 1: Identify the Attack Surface
1. List every input the solution accepts.
2. For each input, identify the boundary: minimum, maximum, zero, negative, empty, single element.
3. Identify every assumption the solution makes (e.g., "input is sorted", "N ≥ 1"). Assumptions are attack vectors.

### Phase 2: Generate Counterexamples
- **Boundary attacks**: test at every boundary and just inside/outside it.
- **Degenerate inputs**: empty, single element, all identical, strictly monotonic.
- **Adversarial combinations**: combine extreme values in unexpected ways.
- **Perturbation**: take a known-correct input and mutate one element at a time.

### Phase 3: Differential Testing (if an oracle exists)
1. Write or identify a naive, obviously-correct reference implementation (the oracle).
2. Generate random inputs within the valid domain.
3. Run both the solution and the oracle on the same input.
4. Any mismatch is a bug. Use the mismatching input to debug.
5. Run ONE bounded batch of random cases (50–500, whichever is cheap for the oracle). If clean, stop — do NOT scale the batch up or repeat passes indefinitely. Note the case count in the verdict.

### Phase 4: Verdict
- **PASS**: all generated cases match the oracle (or match the expected output), no counterexample found.
- **FAIL**: a specific input produces an incorrect output. Record the input, the expected output, and the actual output.

## Anti-Patterns

| Anti-Pattern | Why It's Bad | Do Instead |
|--------------|--------------|------------|
| Testing only the happy path | Misses the edge cases where bugs hide | Always include degenerate and boundary inputs |
| Reusing the solution's own logic in the test | The test inherits the solution's bugs | The oracle must be independently correct |
| Unbounded scaling | A second full pass rarely adds value and burns the time budget | Cap the total case count; report the cap in the verdict |
| Vague failure reports | "It failed" is not actionable | Record the exact input, expected, and actual output |

## Verification Checklist

- [ ] Every input boundary was tested.
- [ ] Degenerate inputs (empty, single, all-same) were tested.
- [ ] A bounded batch of random differential cases was run (if an oracle exists), and the count is recorded.
- [ ] Every assumption in the solution was attacked.
- [ ] The verdict is PASS or FAIL with concrete evidence.
