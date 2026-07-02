# Tasks — PROBE Handler

> T# numbering continues from T53 (ambient-signs spec). Every task names its test
> before implementation (spec-workflow golden rule).

- [x] T54 [R53] — Add `Stimulus` and `STIMULI` to `src/shared/src/signs.ts`; add
  `ProbePayload` and `ProbeResultPayload` to `src/shared/src/fieldMessages.ts`.
  Test: `src/shared/src/fieldMessages.test.ts` — `STIMULI` contains exactly the four
  literals; payload types compile with `Sign` only (no trait-type imports anywhere
  in the shared package).

- [x] T55 [R58, P22] — Add `AMBIENT_AXES` to `src/server/src/incarnate/types.ts`
  and `deriveAmbientSigns` to `src/server/src/incarnate/deriveSigns.ts`.
  Test: `src/server/src/incarnate/deriveSigns.test.ts` — for every tier,
  `deriveAmbientSigns` output contains no `REACTION` channel; Apprentice = 3 signs,
  Journeyman = 4, Master = 5; determinism (same inputs → same output).

- [x] T56 [R55, R56, P20, P21] — Implement `deriveReaction`, `NO_REACTION_SIGN`,
  and `PROBE_EXPOSURE_COST` in `src/server/src/incarnate/deriveReaction.ts`.
  Test: `src/server/src/incarnate/deriveReaction.test.ts` — matching stimulus at
  Journeyman/Master returns the ward's lexicon REACTION sign; non-matching stimulus
  and Apprentice tier both return `NO_REACTION_SIGN` (miss ≡ no-ward); purity: same
  inputs → same output; output keys are exactly `['channel', 'token']` and never a
  ward value literal on a miss.

- [x] T57 [R57, R58] — Add `exposure: number` and `revealedSigns: Sign[]` to
  `RoomRecord` in `src/server/src/rooms/types.ts`; initialize in `RoomManager`
  room creation and reset both in `handleDeploy`.
  Test: `src/server/src/rooms/RoomManager.test.ts` — a created room has
  `exposure === 0` and `revealedSigns` empty; `src/server/src/rooms/handlers/deploy.test.ts`
  — after DEPLOY, `exposure === 0` and `revealedSigns` empty.

- [x] T58 [R54, R56, R57, P21, P23] — Implement `handleProbe` in
  `src/server/src/rooms/handlers/probe.ts` (validate shape → assertPhase FIELD →
  mutate exposure/revealedSigns → broadcast `PROBE_RESULT`).
  Test: `src/server/src/rooms/handlers/probe.test.ts` — invalid stimulus →
  `INVALID_PAYLOAD` to sender only, no mutation, no broadcast; wrong phase / no
  room → `WRONG_PHASE`, no mutation; valid probe → one `PROBE_RESULT` broadcast
  with correct `playerId`, `stimulus`, `sign`, incremented `exposure`; non-leader
  can probe; repeat probe of same stimulus costs exposure again but does not
  duplicate `revealedSigns`; payload JSON contains no ward literal on a miss.

- [x] T59 [R54] — Route `PROBE` in `src/server/src/rooms/messageRouter.ts`.
  Test: `src/server/src/rooms/messageRouter.test.ts` — a `PROBE` message reaches
  the handler (valid probe in FIELD phase produces a `PROBE_RESULT` broadcast);
  unknown types still hit `handleUnknownMessage`.

- [x] T60 [R58, P22, P24] — Switch `handleDeploy` and `buildFieldSnapshot` to
  `deriveAmbientSigns`; `buildFieldSnapshot` appends `room.revealedSigns`.
  Test: `src/server/src/rooms/snapshot.test.ts` — FIELD-phase snapshot signs =
  ambient signs ++ revealedSigns; no REACTION channel when `revealedSigns` is
  empty; `src/server/src/rooms/handlers/deploy.test.ts` — `FIELD_STARTED.signs`
  contains no REACTION channel at any tier.

- [x] T61 [R53–R58, P20–P24] — Integration test: extend
  `src/server/src/rooms/field.integration.test.ts` with the full probe flow —
  deploy, a non-leader probes a miss (no-reaction, exposure 1), probes the ward
  match (drinks-X, exposure 2), a player reconnects and the snapshot carries
  ambient + revealed signs, then extraction still works. Trait containment
  asserted on every wire payload seen.
