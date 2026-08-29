---
name: research-reasoning
description: Methodology for open-ended analytical problems, novel proof construction, and first-principles reasoning. Covers creative problem solving, hypothesis generation, rigorous logic, and avoiding confirmation bias. Use for novel proof construction, open-ended analysis, or problems with no known template.
use_for: Open-ended analytical problems, novel proof construction, first-principles reasoning.
dont_use_for: Routine software engineering (use software-engineering) or machine-checked proofs (use formal-verification).
---

# Research & Reasoning Playbook

## Core Principle
Start from what is given, not from what you hope to prove. Every inference step must be traceable to a premise or a previously established result.

## Workflow

### Phase 1: Decompose
1. State the problem in your own words. If you cannot state it precisely, the problem is not yet understood.
2. List the knowns (given facts, constraints, definitions) and the unknowns (what must be shown or found).
3. Identify the gap between knowns and unknowns. The gap IS the problem.

### Phase 2: Generate Hypotheses
- Produce at least two distinct approaches before committing to one.
- For each approach, state the key assumption it relies on.
- Prefer the approach whose key assumption is easiest to verify.

### Phase 3: Reason Rigorously
- One inference per line. Each line cites its justification (a premise, a definition, or a prior line).
- When a step feels like a jump, it is. Insert the missing step or mark it as an explicit assumption.
- Distinguish between "for all x" and "there exists x" — quantifier errors are the most common reasoning failure.

### Phase 4: Self-Attack
- Try to disprove your own conclusion. Find the weakest step.
- Check boundary cases: empty set, single element, maximum, negative, zero.
- If a counterexample exists, the conclusion is wrong — do not patch it, restart from the failing step.

## Anti-Patterns

| Anti-Pattern | Why It's Bad | Do Instead |
|--------------|--------------|------------|
| Confirmation bias | Only seeking evidence that supports the hypothesis | Actively seek disconfirming evidence |
| Skipped steps | Hides the actual gap in the argument | One inference per line, cited |
| Circular reasoning | The conclusion is assumed in a premise | Trace the dependency graph; no cycles |
| Premature generalization | A pattern from 2 cases is not a theorem | Prove the general case or state the limit |

## Output Checklist

- [ ] The problem is restated precisely.
- [ ] At least two approaches were considered; the rejected ones and reasons are recorded.
- [ ] Every inference step is cited.
- [ ] Boundary cases were checked.
- [ ] The weakest step is identified and reinforced or flagged.
