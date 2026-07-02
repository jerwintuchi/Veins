# Tasks — Incarnate Trait Schema & Sign Language

> Phase 4, spec 1. T# numbering continues from T38 (field-phase). Ordered:
> shared types → server types → data table → pure functions → cross-check.
> No handler wiring in this spec. Every task names its test file and describes
> what the test verifies before any implementation is written.

---

## Shared Types

- [x] T39 [R38, P12, P16] — Define `Channel`, `SignToken`, `Sign`, and `Tier` in
  `src/shared/src/signs.ts`. Add `export * from './signs.js'` to
  `src/shared/src/index.ts`.
  Test: `src/shared/src/signs.test.ts` — verifies (a) `Channel` is a union of exactly
  six literals — checked via an exhaustive switch that assigns all six values and a
  `// @ts-expect-error` on a seventh; (b) `Sign` has exactly the fields `channel` and
  `token` (TypeScript `satisfies { channel: Channel; token: SignToken }` check); (c)
  `Tier` is a union of exactly three literals (`'APPRENTICE'`, `'JOURNEYMAN'`,
  `'MASTER'`) — verified via exhaustive switch; (d) a `Sign` object with an extra
  `axis` field does not satisfy the `Sign` type (compile-time `@ts-expect-error`
  assertion).

---

## Server: Trait Types

- [x] T40 [R33, R37, P16] — Define server-only trait types in
  `src/server/src/incarnate/types.ts`: `TraitAxis`, `AspectValue`, `FrailtyValue`,
  `WardValue`, `DispositionValue`, `RiteKeyValue`, `TellValue`, `TraitRoll`,
  `ACTIVE_AXES`. Must not be re-exported from `@testament/shared`.
  Test: `src/server/src/incarnate/types.test.ts` — verifies (a) a value assignable to
  `TraitRoll` requires `aspect`, `frailty`, `tell` (compile-time `satisfies` check
  with just those three fields succeeds); (b) `ACTIVE_AXES.APPRENTICE` has length 3;
  (c) `ACTIVE_AXES.JOURNEYMAN` has length 5; (d) `ACTIVE_AXES.MASTER` has length 6;
  (e) every axis appears exactly once in `ACTIVE_AXES.MASTER`; (f) `ACTIVE_AXES.APPRENTICE`
  entries are a strict subset of `ACTIVE_AXES.MASTER` (no axis added out of tier order).

---

## Server: Sign Lexicon

- [x] T41 [R39, P13, P14, P15] — Define `SIGN_LEXICON` and `LexiconEntry` in
  `src/server/src/incarnate/lexicon.ts`. The constant is typed as
  `ReadonlyArray<LexiconEntry>`.
  Test: `src/server/src/incarnate/lexicon.test.ts` — verifies (a) `SIGN_LEXICON` has
  exactly 24 entries (4 values × 6 axes); (b) all `token` values are unique — no two
  entries share the same `SignToken` (P14); (c) every entry's `channel` is a valid
  `Channel` value; (d) grouping entries by `axis` yields exactly 6 groups each with
  exactly 4 entries (completeness, one group per axis); (e) no entry's `token` string
  equals any axis value literal (e.g., `'EMBER'`, `'FLAME'`, `'LUNGE'`, etc.) — this
  is a P12 guard at the data level preventing accidental sign token/value collisions.

---

## Server: Pure Functions

- [x] T42 [R34, R35, R40, P12, P13, P15] — Implement
  `deriveSigns(traits: TraitRoll, tier: Tier): Sign[]` in
  `src/server/src/incarnate/deriveSigns.ts`. The function reads `ACTIVE_AXES[tier]`,
  looks up each axis+value pair in `SIGN_LEXICON`, and returns `{ channel, token }`
  objects. Throws a descriptive `Error` if a lexicon entry is missing (programming
  error, not a user error).
  Test: `src/server/src/incarnate/deriveSigns.test.ts` — verifies (a) Apprentice call
  returns exactly 3 Signs with channels `['RESIDUE', 'STRESS_MARK', 'OMEN']` in that
  order; (b) Journeyman call returns 5 Signs, adding `'REACTION'` and `'SPOOR'`; (c)
  Master call returns 6 Signs, adding `'LITURGY'`; (d) every Sign in the output has
  exactly the keys `'channel'` and `'token'` — `Object.keys(sign).sort()` equals
  `['channel', 'token']`; (e) `JSON.stringify(output)` does not contain any axis value
  literal substring (e.g., `'EMBER'`, `'FLAME'`, `'LUNGE'`, `'STALKER'`, `'PENANCE'`)
  — P12/R40; (f) calling twice with the same input returns structurally identical output
  (stability — P15).

- [x] T43 [R36, R37, R41, P15] — Implement
  `generateTraitRoll(rng: Rng, tier: Tier): TraitRoll` in
  `src/server/src/incarnate/generateTraitRoll.ts`. Uses only `rng.pick()` for randomness.
  Test: `src/server/src/incarnate/generateTraitRoll.test.ts` — verifies (a) Apprentice
  roll has `aspect`, `frailty`, `tell` as own keys and does not have `ward`,
  `disposition`, or `riteKey` (`Object.keys` check); (b) Journeyman roll adds `ward`
  and `disposition` and still lacks `riteKey`; (c) Master roll has all six fields;
  (d) two calls with identically seeded `Rng` instances (`createRng(hashSeed('seed-a'))`
  × 2) return structurally identical rolls (determinism — P15/R36); (e) generated
  `aspect` values fall within `['EMBER','FROST','ROT','MIRE']`, `frailty` within
  `['FLAME','COLD','SALT','LIGHT']`, etc. — checked for all six axes across 20 randomly
  seeded rolls; (f) the source file for `generateTraitRoll` does not import `node:crypto`
  or reference `Math.random` (static check via reading the file's import list in the test).

---

## Completeness Cross-check

- [x] T44 [R39, P13] — Write a cross-check test in
  `src/server/src/incarnate/completeness.test.ts` that verifies lexicon completeness
  and deriveSigns robustness across all reachable trait combinations.
  Test: (a) iterates over all six active axes in `ACTIVE_AXES.MASTER` and for each
  axis enumerates all four v1 values; asserts a matching `SIGN_LEXICON` entry exists
  for every `(axis, value)` pair — catches future axis-value additions that forget to
  update the lexicon (P13); (b) constructs a synthetic full Master `TraitRoll` for
  each of the 4^6 = 4096 combinations (or a representative sample of 100 random seeds
  at each tier) and calls `deriveSigns`; asserts no call throws; (c) asserts the total
  count of unique tokens across all `SIGN_LEXICON` entries equals 24 (one per
  axis/value pair — P14 regression guard).
