---
name: competitive-programming
description: Problem-solving methodology for competitive programming covering algorithm design, data structure selection, dynamic programming, graph theory, mathematical reasoning (number theory, combinatorics, game theory), and solution verification. Covers ICPC, IOI, Codeforces, TopCoder, AtCoder, and SPOJ problem types. Use when solving algorithmic problems with time/space constraints, designing efficient algorithms, analyzing complexity, performing stress testing, or reasoning about correctness. Don't use for general software engineering tasks.
use_for: Solving algorithmic problems with time/space constraints, designing efficient algorithms, analyzing complexity, or reasoning about correctness.
dont_use_for: General software engineering tasks.
---

# Competitive Programming Playbook

This playbook covers the full spectrum of competitive programming (CP) topics across ICPC, IOI, Codeforces, TopCoder, SPOJ, AtCoder, and similar platforms. Use it to guide problem analysis, algorithm selection, and solution verification.

## Problem Analysis Framework

Before implementing, follow this sequence:

1. **Read the problem twice** — identify inputs, outputs, constraints, and edge cases
2. **Classify the problem** — map to one or more topic categories below
3. **Analyze constraints** — determine required time complexity
4. **Identify the key insight** — most CP problems have one non-obvious observation
5. **Plan before coding** — outline the approach in pseudocode or comments

## Constraint-to-Complexity Guide

| Constraint (N) | Target Complexity | Typical Approaches |
|----------------|-------------------|--------------------|
| N ≤ 10 | O(N!) | Brute force, permutation enumeration |
| N ≤ 20 | O(2^N) | Bitmask DP, meet in the middle |
| N ≤ 500 | O(N³) | Floyd-Warshall, cubic DP, matrix multiplication |
| N ≤ 5000 | O(N²) | Quadratic DP, pairwise comparison |
| N ≤ 10⁵ | O(N log N) | Sorting, segment tree, binary search, merge sort |
| N ≤ 10⁶ | O(N) | Linear scan, hashing, two pointers, prefix sums |
| N ≤ 10⁸ | O(√N) or O(log N) | Math, binary search on answer, prime sieve |
| N ≤ 10¹⁸ | O(log N) | Binary exponentiation, matrix exponentiation |

## Topic Taxonomy

### Algorithm Design Paradigms

Greedy (exchange arguments, scheduling, matroid), Divide & Conquer, DP (see below), Backtracking, Randomized, Meet in the Middle, Constructive.

### Dynamic Programming

Linear, Interval, Tree, Digit, Bitmask, Profile/Broken Profile DP.
Optimizations: Convex hull trick, D&C optimization, Knuth's, aliens trick (WQS). Probability/expected value DP.

### Graph Theory

Traversal (BFS/DFS/topo sort), Shortest paths (Dijkstra/Bellman-Ford/Floyd), MST (Kruskal/Prim/Borůvka), Connectivity (bridges, articulation, SCC, 2-SAT), Trees (LCA, HLD, centroid decomposition), Network flow (Dinic, MCMF, matching), Euler paths, Functional graphs.

### Data Structures

Segment tree (lazy/persistent/iterative), BIT/Fenwick, Sparse table, √-decomposition, Treap/Splay, DSU (rollback, weighted), Link-cut tree, Mo's algorithm, Persistent structures, Merge sort tree.

### Strings

KMP, Z-function, Rabin-Karp, Trie/Aho-Corasick, Suffix array (SA-IS), Suffix automaton, Manacher, Palindromic tree, Lyndon factorization.

### Mathematics

- **Number Theory**: Sieve, Miller-Rabin, Pollard's rho, CRT, BSGS, Euler's totient, Möbius, NTT
- **Combinatorics**: Binomial (Lucas), Catalan, Stirling, Burnside/Pólya, generating functions, inclusion-exclusion
- **Game Theory**: Sprague-Grundy, Nim variants, combinatorial games
- **Linear Algebra**: Gaussian elimination, matrix exponentiation, XOR basis
- **Probability**: Linearity of expectation, Markov chains

### Geometry

Convex hull, sweep line, rotating calipers, half-plane intersection, point-in-polygon, Welzl's algorithm, closest pair.

### Miscellaneous

Two pointers, binary search on answer, coordinate compression, small-to-large merging, hashing, interactive problems, bit manipulation.

## Edge Case Checklist

- **Empty/minimal**: N=0, N=1, empty strings, single elements
- **Maximum**: N at upper bound, values at INT_MAX/INT_MIN
- **Degenerate**: all same elements, sorted/reverse-sorted, star/chain/complete graphs
- **Overflow**: intermediate multiplication exceeding 64-bit
- **Boundary**: off-by-one in ranges, inclusive vs exclusive
- **Special values**: zeroes, negative numbers, modular edge cases

## Stress Testing

1. Write a naive brute-force solution
2. Generate random inputs within small constraints (N ≤ 20)
3. Compare outputs of optimized vs brute-force on thousands of cases
4. If mismatch found, use the failing case to debug

## Implementation Pitfalls

- **Integer overflow**: Use 64-bit integers; watch `mid = (l+r)/2` overflow
- **Floating point**: Prefer integer arithmetic; use epsilon if unavoidable
- **Off-by-one**: Double-check binary search bounds
- **Uninitialized state**: Clear arrays between test cases
- **Stack overflow**: Convert deep recursion to iterative
- **TLE traps**: slow I/O, unnecessary copies, repeated work

## Verification Checklist

- [ ] All sample test cases pass
- [ ] Edge cases pass
- [ ] No integer overflow in intermediate computations
- [ ] Runs within time limit on worst-case input
- [ ] Memory within limit
- [ ] Stress tested against brute force
- [ ] Multi-test cleanup: global state reset between cases
