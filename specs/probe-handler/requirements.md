# Requirements — PROBE Handler

> Phase 4, spec 4. The "Test" verb of the spine: a Seeker applies a stimulus to the
> Incarnate and reads the reaction. The server computes the Reaction sign from the
> hidden Ward trait, broadcasts it to the room, and charges exposure. This spec also
> makes the REACTION channel probe-gated: it is removed from ambient sign delivery
> (it was ambient at Journeyman+ since spec 3, which would make probing redundant —
> see docs/systems/investigation-and-probing.md and DECISION_LOG TD-025).
>
> No per-player channel filtering in this spec — probe results broadcast to all
> players in the room. That comes in spec 5 (Distributed Perception). No bag-item
> consumption — the loadout economy is a later spec; every Seeker can probe.
>
> R# numbering continues from R52 (ambient-signs spec).

---

## Functional Requirements

**R53**: As the shared wire protocol, the probe messages are typed in
`@testament/shared` with no trait types.
- AC: `Stimulus` is the union `'FLAME' | 'COLD' | 'SALT' | 'LIGHT'` and
  `STIMULI` is the readonly array of all four, exported from `src/shared/src/signs.ts`.
- AC: `ProbePayload = { stimulus: Stimulus }` (client → server) and
  `ProbeResultPayload = { playerId: string; stimulus: Stimulus; sign: Sign; exposure: number }`
  (server → client) are exported from `src/shared/src/fieldMessages.ts`.
- AC: Neither type references `TraitRoll`, `TraitAxis`, `WardValue`, or any other
  server-only trait type.

**R54**: As the server, when a client sends `PROBE`, the message is validated and
authorized before any state changes (I2).
- AC: A payload whose `stimulus` is missing, not a string, or not one of the four
  `Stimulus` literals → `LOBBY_ERROR` with code `INVALID_PAYLOAD` to the sender
  only; no state mutation, no broadcast.
- AC: A `PROBE` from a socket not in any room → `LOBBY_ERROR` with code
  `NOT_IN_ROOM`; in a room whose phase is not `FIELD` → `LOBBY_ERROR` with code
  `WRONG_PHASE`. Both to the sender only; no state mutation, no broadcast
  (matches the established `assertPhase` behavior).
- AC: A valid `PROBE` in FIELD phase → exactly one `PROBE_RESULT` broadcast to the
  room, carrying the sender's `playerId`, the echoed `stimulus`, the derived
  `sign`, and the room's new `exposure`.
- AC: Any player may probe, not only the leader.

**R55**: As the server, the reaction is derived purely from the hidden trait roll
(I5): the sign, never the trait.
- AC: `deriveReaction(traits, tier, stimulus)` is a pure function in
  `src/server/src/incarnate/`; same inputs → same `Sign`, always.
- AC: When the Ward axis is active for the contract tier and
  `traits.ward === stimulus`, the result is the `REACTION` lexicon sign for that
  ward value (e.g. ward `FLAME` + stimulus `FLAME` → token `drinks-flame`).
- AC: When the Ward axis is active and `traits.ward !== stimulus`, or the Ward
  axis is not active for the tier (Apprentice), the result is the fixed
  no-reaction sign `{ channel: 'REACTION', token: 'no-reaction' }`.

**R56**: As the server, a probe result never exposes the underlying trait roll.
- AC: `ProbeResultPayload` has no `traitRoll`, `ward`, or `expeditionSeed` key;
  `Object.keys(sign)` equals `['channel', 'token']`.
- AC: `JSON.stringify(payload)` contains no axis value literal except the
  client-chosen `stimulus` echo (the stimulus is party behavior, not Incarnate
  knowledge). In particular, when the probe does not match the ward, the payload
  contains no hint of what the ward actually is.

**R57**: As the server, probing costs exposure, so it is never free (Pillar 1,
TD-004).
- AC: `RoomRecord.exposure` starts at `0` when the field phase begins (DEPLOY).
- AC: Each successful probe increments `exposure` by `PROBE_EXPOSURE_COST` (1).
- AC: A rejected probe (bad payload, wrong phase) does not change `exposure`.
- AC: Probing the same stimulus again still costs exposure (re-testing is legal
  but not free).

**R58**: As the server, the REACTION channel is probe-gated, and probe results
survive reconnection.
- AC: Ambient signs (`FIELD_STARTED.signs` and the ambient portion of
  `FieldSnapshot.signs`) never contain a `REACTION`-channel sign at any tier.
- AC: Each distinct reaction sign revealed by a probe is recorded server-side in
  `RoomRecord.revealedSigns` (deduplicated by token).
- AC: A player reconnecting during FIELD phase receives
  `fieldSnapshot.signs = ambient signs + revealed reaction signs`.
