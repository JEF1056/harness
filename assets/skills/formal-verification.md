---
name: formal-verification
description: Methodology for machine-checked proofs and program correctness using proof assistants (Lean 4, Coq, Isabelle). Covers translating informal math into formal statements, tactic strategies, automation, and proof structuring. Use when writing machine-checked proofs, verifying program correctness formally, or working in a proof assistant.
use_for: Machine-checked proofs, formal verification of programs, working in Lean 4/Coq/Isabelle.
dont_use_for: Informal mathematical reasoning without a proof assistant (use research-reasoning).
---

# Formal Verification Playbook

## Workflow

### Phase 1: Formalize the Statement
1. Read the informal statement and extract the exact quantifier structure (∀, ∃, →, ↔).
2. Write the theorem statement FIRST. The statement must be provable — check it against counterexamples before proving.
3. Verify the statement type-checks (or parses) before any proving work.
4. If the statement is too hard, split it into lemmas. Name lemmas by what they assert, not by step number.

### Phase 2: Choose the Proof Strategy
| Situation | Strategy |
|-----------|----------|
| Universal statement over a structure | Induction on the structure |
| Existential statement | Construct the witness explicitly |
| Contradiction-prone | Prove by contradiction or classical logic if available |
| Heavy computation | Define a function, prove properties of it, use it |
| Case analysis | `cases` / `destruct` on the discriminant, keep cases minimal |

### Phase 3: Tactic Discipline
- One goal at a time. After each tactic, check the goal state.
- Prefer automation (`simp`, `omega`, `linarith`, `decide`, `norm_num`, `tauto`) before manual reasoning.
- Introduce lemmas only when automation fails twice; state them as separate named results.
- If stuck for 3 attempts on one subgoal, restructure the proof — the decomposition is likely wrong.

### Phase 4: Verification
- [ ] The theorem statement matches the informal claim exactly (no weakened quantifiers).
- [ ] The proof compiles / checks cleanly with no `sorry` / `admit` / `sorry!` holes.
- [ ] No axioms added that the environment does not already provide.
- [ ] The proof is re-run from a clean state to confirm it is not relying on stale state.

## Anti-Patterns

| Anti-Pattern | Why It's Bad | Do Instead |
|--------------|--------------|------------|
| Weakening the statement to make it provable | Proves something weaker than required | Prove the original; add assumptions only if justified |
| Hiding a hole behind a `sorry` | The proof is incomplete | Track every hole; report any remaining explicitly |
| One giant tactic block | Unmaintainable, hard to debug | Small tactics, one goal at a time |
| Adding an axiom to close a gap | May make the logic inconsistent | Search for an existing lemma first |
