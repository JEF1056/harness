---
name: proof-rigor-verification
description: Methodology for verifying the correctness of mathematical proofs, both informal and formal. Covers logical soundness checking, gap detection, assumption auditing, and quantifier discipline. Use when reviewing or verifying a proof for correctness before acceptance.
use_for: Verifying proof correctness (informal or formal), logical soundness checking, gap detection.
dont_use_for: Constructing a new proof from scratch (use research-reasoning or formal-verification).
---

# Proof Rigor Verification Playbook

## Core Principle
A proof is a chain of implications. Verify every link. A single broken link invalidates the entire proof, regardless of how elegant the rest is.

## Workflow

### Phase 1: Statement Check
1. Does the proof actually prove the stated theorem? Compare the conclusion of the proof against the theorem statement, quantifier by quantifier.
2. Are all variables in the theorem bound correctly? (A free variable where a bound one is expected is a fatal flaw.)
3. Are the assumptions of the theorem the only assumptions used? Any extra assumption must be justified or the proof is of a stronger (or different) statement.

### Phase 2: Link-by-Link Verification
For each step in the proof:
1. **Identify the inference**: what is the premise, what is the conclusion, what rule or lemma justifies the step?
2. **Check the rule**: is the inference rule valid in this context? (e.g., dividing by a quantity that might be zero, applying a theorem whose hypotheses are not met)
3. **Check the scope**: does the step stay within the scope of the quantifiers and assumptions in force?
4. **Mark the step**: SOUND, SUSPICIOUS (needs justification), or BROKEN (invalid inference).

### Phase 3: Gap Detection
- Look for steps that say "it is clear that", "without loss of generality", "similarly", "by symmetry". Each of these is a hidden sub-proof. Expand it or flag it.
- "Without loss of generality" is only valid if the argument is symmetric under the transformation. Verify the symmetry.
- Check that case analyses are exhaustive. List the cases; confirm they partition the domain.

### Phase 4: Assumption Audit
1. List every assumption used in the proof, with the line where it is introduced.
2. For each assumption: is it given by the theorem, or is it an implicit choice?
3. Any implicit assumption that is not universally true must be justified or the proof is incomplete.

### Phase 5: Verdict
- **VALID**: every link is SOUND, the statement check passes, no unflagged gaps.
- **INVALID**: at least one BROKEN link or an unflagged gap. Record the exact step, the flaw, and the minimal fix.

## Anti-Patterns

| Anti-Pattern | Why It's Bad | Do Instead |
|--------------|--------------|------------|
| Trusting the author's "clearly" | Hides the actual gap | Expand every "clearly" into explicit steps |
| Checking only the first and last step | Misses the broken middle | Verify every link |
| Accepting a stronger statement as the theorem | Proves something different | Compare conclusion to theorem quantifier by quantifier |
| Ignoring the assumption audit | Implicit assumptions are the most common flaw | List and justify every assumption |

## Verification Checklist

- [ ] The conclusion matches the theorem statement exactly.
- [ ] Every inference step is marked SOUND / SUSPICIOUS / BROKEN.
- [ ] Every "clearly" / "WLOG" / "similarly" is expanded or flagged.
- [ ] Case analyses are exhaustive.
- [ ] Every assumption is listed and justified.
- [ ] The verdict is VALID or INVALID with the exact failing step.
