---
name: search-candidate-management
description: Methodology for multi-attempt problem solving with explore-exploit tradeoffs. Covers maintaining a candidate pool, path dependency prevention, solution diversification, and when to abandon a branch. Use for problems requiring multiple solution attempts, best-of-N search, or explore-exploit tradeoffs.
use_for: Multi-attempt problem solving, explore-exploit tradeoffs, best-of-N search, solution diversification.
dont_use_for: Single-shot tasks where only one attempt is made.
---

# Search Candidate Management Playbook

## Core Principle
Diversity of candidates matters more than depth of any single candidate. A pool of 5 distinct partial solutions beats one over-invested solution that hits a dead end.

## Workflow

### Phase 1: Seed the Pool
1. Generate an initial pool of candidates using DIFFERENT strategies — not the same strategy with different parameters.
2. Record for each candidate: the strategy used, the current state, and the key assumption it relies on.
3. Cap the pool size (typically 5-10). If exceeded, prune before adding.

### Phase 2: Explore-Exploit Balance
| Pool State | Action |
|------------|--------|
| All candidates progressing | Exploit: deepen the most promising candidate |
| One candidate stalled | Explore: spawn a new candidate with a different strategy |
| Multiple candidates stalled | Re-evaluate the problem decomposition — the framing may be wrong |
| One candidate clearly ahead | Exploit hard: concentrate effort, prune the rest |

- Do NOT abandon a candidate after one failure. A stalled candidate may need a different next step, not a new start.
- Do NOT keep a candidate alive past 3 failed extensions. Prune it and record why it failed.

### Phase 3: Path Dependency Prevention
- Before extending a candidate, check: does this extension commit to an assumption that other candidates rejected? If yes, the branches are diverging — that is good, keep them separate.
- Merge candidates only when they reach the same intermediate result via different paths. The merge is a cross-check, not a shortcut.
- Never let one candidate's failure silently invalidate another's assumptions. Each candidate's assumption set is independent.

### Phase 4: Selection
- Rank candidates by: (1) verifiable progress toward the goal, (2) remaining distance, (3) distinctiveness from other candidates.
- Select the top candidate for final push. Discard the rest, but record their dead ends — they prevent re-exploration.

## Anti-Patterns

| Anti-Pattern | Why It's Bad | Do Instead |
|--------------|--------------|------------|
| Sunk cost | Continuing a failing branch because of invested effort | Prune after 3 failed extensions; record the dead end |
| Homogeneous pool | 5 candidates that are really 1 idea | Force distinct strategies at seed time |
| Premature convergence | Killing diversity too early | Keep at least 2 distinct strategies alive until the final phase |
| Silent assumption sharing | One candidate's failure invalidates others | Track assumption sets per candidate explicitly |

## Output Checklist

- [ ] The candidate pool is documented with strategy, state, and assumptions per candidate.
- [ ] Pruning decisions are recorded with the reason.
- [ ] At least 2 distinct strategies were explored.
- [ ] The selected candidate's path is traceable from the pool.
- [ ] Dead ends are recorded to prevent re-exploration.
