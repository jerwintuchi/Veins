# Spec Workflow

Every feature in Veins follows this chain. Nothing skips a step.

## The Chain
```
R# (requirement) → design.md entry → T# (task) → test → implementation → mark T# done
```

**Nothing is "done" without a passing test that is named in the task.**

## Step-by-Step

### 1. Write requirements first (`requirements.md`)
- Each requirement gets an `R#` ID (R1, R2, …)
- Format: user story + testable acceptance criterion
  ```
  **R3**: As a player, when my relic is adjacent to a teammate's compatible relic,
  both relics trigger their synergy effects.
  - AC: evaluateSynergies returns true for both relics given a valid adjacent board state
  - AC: synergy does NOT fire if both relics have the same ownerId
  ```
- Correctness properties (determinism, server authority, etc.) are requirements too — give them R# IDs

### 2. Write the design entry (`design.md`)
- Data models for new types
- Algorithm description with inputs/outputs
- Correctness properties (P#) that the implementation must satisfy
- Socket.io events emitted/received (name, payload shape)
- Reference the R# IDs this design satisfies

### 3. Write tasks (`tasks.md`)
- Each task gets a `T#` ID
- Format:
  ```
  - [ ] T2 [R3, P1, P2] — Implement `evaluateSynergies` in `src/server/src/board/synergy.ts`
    Test: `synergy.test.ts` — property: same input → same output; solo owner never synergizes; mutual firing confirmed
  ```
- The test file and test description must be named BEFORE writing implementation code

### 4. Write the test
- Tests go alongside source: `src/server/src/**/*.test.ts`
- Write enough test cases to cover the ACs in the requirement
- For correctness properties (determinism, purity): use property-based patterns

### 5. Write the implementation
- Make the tests pass
- Do not exceed what the spec requires

### 6. Mark task done
- Change `[ ]` to `[x]` in tasks.md
- If you discover the requirement was wrong or incomplete, update requirements.md and add an entry to DECISION_LOG.md explaining why

## Switching Active Spec
When moving from one feature to another, update CLAUDE.md's `## Active Spec` block:
```markdown
## Active Spec
<!-- SWAP THESE THREE LINES when switching features -->
@specs/<new-feature>/requirements.md
@specs/<new-feature>/design.md
@specs/<new-feature>/tasks.md
```
Add a DECISION_LOG.md entry: "Switched active spec from X to Y — reason."

## Golden Rule
If you can't point to a test that verifies it, the feature doesn't exist.
