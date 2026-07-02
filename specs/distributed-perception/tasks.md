# Tasks — Distributed Perception

> T# numbering continues from T61 (probe-handler spec). Every task names its test
> before implementation (spec-workflow golden rule).

- [x] T62 [R59] — Add `CHANNELS` to `src/shared/src/signs.ts`; add
  `perceivedChannels: Channel[]` to `FieldStartedPayload`
  (`src/shared/src/fieldMessages.ts`) and `FieldSnapshot`
  (`src/shared/src/fieldPhase.ts`); change `ProbeResultPayload.sign` to
  `Sign | null`.
  Test: `src/shared/src/signs.test.ts` — `CHANNELS` lists all six channels once,
  in canonical order; `src/shared/src/fieldMessages.test.ts` — payloads compile
  with the new fields and with `sign: null`.

- [x] T63 [R60, P25, P26, P27] — Implement `channelsForTier`, `assignPerception`,
  `filterSigns`, and `MIN_CHANNELS_PER_PLAYER` in
  `src/server/src/rooms/perception.ts`.
  Test: `src/server/src/rooms/perception.test.ts` — `channelsForTier` returns the
  4/5/6 tier-relevant channels in canonical order; determinism (same seed → same
  assignment; different seeds → different assignments exist); union = input
  channels for party sizes 1–4 at every tier; every player ≥ 2 channels; solo
  gets all; every assigned list is sorted in canonical order; `filterSigns`
  keeps exactly the in-set signs, preserving order.

- [x] T64 [R61, P27, P28] — Add `perceivedChannels: Channel[]` (default `[]`) to
  `ServerPlayerEntry`; in `handleDeploy`, assign perception with an rng seeded
  from `hashSeed(expeditionSeed + ':perception')`, store per player, and emit
  per-player filtered `FIELD_STARTED` with `perceivedChannels`.
  Test: `src/server/src/rooms/handlers/deploy.test.ts` — solo player receives all
  ambient signs and the full tier channel set; in a 2-player room every emitted
  sign's channel is inside that player's set; the union of both players' sets is
  `channelsForTier(tier)`; deploying twice from the same expedition seed yields
  the same assignment (P25).

- [x] T65 [R62, P28] — Rework `handleProbe` to per-player delivery via `emitTo`:
  everyone in the room gets `playerId`/`stimulus`/`exposure`; only REACTION
  perceivers get `sign`, others get `sign: null`. Router passes `emitTo`.
  Test: `src/server/src/rooms/handlers/probe.test.ts` — in a 2-player room where
  exactly one player perceives REACTION, that player's payload carries the sign
  and the other's carries `sign: null` (even when the non-perceiver is the
  prober); exposure still increments exactly once per probe; validation failures
  emit nothing to anyone else.

- [x] T66 [R63, P28, P29] — `buildFieldSnapshot(room, archive, playerId)` filters
  ambient + revealed signs to that player's set and includes their
  `perceivedChannels`; reconnect handler passes the player through.
  Test: `src/server/src/rooms/snapshot.test.ts` — a REACTION perceiver's snapshot
  includes revealed reaction signs, a non-perceiver's does not; signs outside the
  player's set never appear; `src/server/src/rooms/handlers/reconnect.test.ts` —
  the set is identical before disconnect and after reconnect.

- [x] T67 [R59–R63, P25–P29] — Integration: extend
  `src/server/src/rooms/field.integration.test.ts` — 2-player Journeyman
  expedition: each player's FIELD_STARTED signs are within their announced
  `perceivedChannels` and the union covers the tier channels; a probe delivers
  the sign only to REACTION perceivers (others `sign: null`); a reconnecting
  player gets the same `perceivedChannels` and a correctly filtered snapshot;
  update existing T38/T61 scenarios for the new payload shapes.
