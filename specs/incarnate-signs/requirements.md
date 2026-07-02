# Requirements — Incarnate Trait Schema & Sign Language

> Phase 4, spec 1. Covers the hidden roll data model and the pure function that derives
> observable Signs from it. No handler wiring in this spec — only types and pure
> server functions. Subsequent specs (contract generation, probing, distributed
> perception) depend on these foundations.
>
> R# numbering continues from R32 (field-phase).

---

## Functional Requirements

**R33**: As the server, I can represent an Incarnate's hidden roll as a typed `TraitRoll`
record with six possible axes, where the set of active axes depends on the contract tier.
- AC: `TraitRoll` is a server-only type with three required fields (`aspect`, `frailty`,
  `tell`) and three optional fields (`ward`, `disposition`, `riteKey`). Apprentice rolls
  populate only the required three; Master rolls populate all six.
- AC: Each axis field holds a value from its v1 enum (4 values per axis; see design.md).
- AC: `TraitRoll` does not appear in any type exported from `@testament/shared`. A
  TypeScript compiler check (using `keyof` or `satisfies`) in a test file verifies this.

**R34**: As the server, `deriveSigns(traits, tier)` produces exactly one `Sign` per active
axis for the given tier, and each `Sign` carries only a `Channel` and a `SignToken`.
- AC: An Apprentice call returns exactly 3 Signs with channels `RESIDUE`, `STRESS_MARK`,
  `OMEN` (Aspect, Frailty, Tell respectively).
- AC: A Journeyman call returns exactly 5 Signs, adding `REACTION` (Ward) and `SPOOR`
  (Disposition).
- AC: A Master call returns exactly 6 Signs, adding `LITURGY` (RiteKey).
- AC: No Sign object has an `axis`, `value`, `traitAxis`, or `traitRoll` field.

**R35**: As the server, the sign language is stable game-truth: the same trait value
always yields the same `SignToken` across all expeditions.
- AC: `deriveSigns` called twice with identical inputs returns identical output.
- AC: The `SIGN_LEXICON` data table is the sole source of the trait-value → SignToken
  mapping; `deriveSigns` performs a table lookup, not conditional logic per value.

**R36**: As the server, `generateTraitRoll(rng, tier)` produces a `TraitRoll`
deterministically from the provided `Rng` — using only `rng.pick()` from the existing
`src/server/src/rng/seeded.ts` utility, never `Math.random()`.
- AC: Calling `generateTraitRoll` with two separately seeded `Rng` instances created
  from the same seed produces identical `TraitRoll` outputs.
- AC: The function populates exactly the axes active for the given tier (R37).
- AC: No call to `crypto` or `Math.random` appears in `generateTraitRoll.ts`.

**R37**: As the server, active axes per tier are:
- Apprentice → Aspect, Frailty, Tell.
- Journeyman → Aspect, Frailty, Tell, Ward, Disposition.
- Master → Aspect, Frailty, Tell, Ward, Disposition, RiteKey.
- AC: `deriveSigns` returns the correct count and correct channels for each tier.
- AC: `generateTraitRoll` populates exactly the active fields and no others.

**R38**: As the shared wire protocol, `Sign`, `Channel`, `SignToken`, and `Tier` are
shared types exported from `@testament/shared` (they appear in field-phase delta events
and client-facing payloads). All trait types (`TraitRoll`, `TraitAxis`, axis value enums,
`ACTIVE_AXES`) are server-only and must not be exported from `@testament/shared`.
- AC: `Channel` is a union of exactly six string literals:
  `'RESIDUE' | 'STRESS_MARK' | 'REACTION' | 'SPOOR' | 'LITURGY' | 'OMEN'`.
- AC: `Sign` has exactly two fields: `channel: Channel` and `token: SignToken`.
- AC: `Tier` is a union of exactly three literals: `'APPRENTICE' | 'JOURNEYMAN' | 'MASTER'`.

**R39**: As the server, the sign lexicon is a pure data table (`SIGN_LEXICON`) in
`src/server/src/incarnate/lexicon.ts`. The table maps `{ axis, value }` pairs to
`{ channel, token }`. `deriveSigns` reads from it via lookup, not via in-code conditionals.
- AC: `SIGN_LEXICON` has exactly 24 entries (4 values × 6 axes).
- AC: All `token` values in `SIGN_LEXICON` are unique — no two entries share the same
  `SignToken`.
- AC: Every `(axis, value)` pair reachable by `generateTraitRoll` at Master tier
  (the widest roll) has a corresponding entry in `SIGN_LEXICON`.

---

## Correctness Requirements

**R40**: As the server, the output of `deriveSigns` must not expose any trait axis name
or axis value to the caller.
- AC: Runtime `Object.keys` on every Sign in the output contains only `'channel'` and
  `'token'`.
- AC: `JSON.stringify(deriveSigns(anyRoll, anyTier))` contains none of the axis value
  literals (`'EMBER'`, `'FROST'`, `'ROT'`, `'MIRE'`, `'FLAME'`, `'COLD'`, `'SALT'`,
  `'LIGHT'`, `'LUNGE'`, `'SWEEP'`, `'RECOIL'`, `'SHUDDER'`, `'STALKER'`,
  `'AMBUSHER'`, `'TERRITORIAL'`, `'FRENZIED'`, `'PENANCE'`, `'IMMOLATION'`,
  `'INTERMENT'`, `'SILENCE'`).

**R41**: As the server, `generateTraitRoll` must be pure with respect to entropy: it
receives all randomness through the `rng` parameter and introduces no other source.
- AC: The function body calls only `rng.pick()` for randomness.
- AC: A static-analysis check (import inspection in the test) confirms no import of
  `crypto` or direct use of `Math.random` in `generateTraitRoll.ts`.
