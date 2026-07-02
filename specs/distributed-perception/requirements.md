# Requirements — Distributed Perception

> Phase 4, spec 5. The forced-cooperation engine (Pillar 4, TD-008,
> docs/systems/distributed-perception.md): perception is split by channel, so no
> single Seeker sees the whole sign table and the theory must be assembled by
> talking. The server assigns each player a perception set at DEPLOY and filters
> every sign delivery (ambient, probe result, reconnect snapshot) to it.
>
> The design doc ties channel assignment to the loadout. The loadout economy is a
> later spec, so this spec uses an interim server-side assignment: a deterministic,
> seeded division of the expedition's relevant channels with overlap. When the
> loadout spec lands, it replaces the assignment source, not the filtering
> machinery. Solo perceives all channels (never lacking, TD-008).
>
> R# numbering continues from R58 (probe-handler spec).

---

## Functional Requirements

**R59**: As the shared wire protocol, perception is expressed per player without
leaking trait data.
- AC: `CHANNELS` — the canonical ordered array of all six `Channel` literals —
  is exported from `src/shared/src/signs.ts`.
- AC: `FieldStartedPayload.perceivedChannels: Channel[]` and
  `FieldSnapshot.perceivedChannels: Channel[]` are required fields (each player
  learns their own set, never other players' sets).
- AC: `ProbeResultPayload.sign` becomes `Sign | null` — `null` means "you cannot
  read the Reaction channel", which is distinct from the `no-reaction` sign.

**R60**: As the server, perception sets are assigned deterministically and cover
the expedition completely.
- AC: `assignPerception(rng, playerIds, channels)` is a pure function in
  `src/server/src/rooms/perception.ts`; same rng seed + same ordered inputs →
  same assignment (I3).
- AC: The union of all players' sets equals the input `channels` at every party
  size 1–4 (the party can always assemble a full read).
- AC: Every player receives at least `MIN_CHANNELS_PER_PLAYER` (2) channels when
  `channels.length >= 2`; a solo player receives all of `channels`.
- AC: The channels distributed are the expedition-relevant ones:
  `channelsForTier(tier)` = the ambient channels for the tier plus `REACTION`
  (Apprentice: RESIDUE, STRESS_MARK, OMEN, REACTION; Journeyman: + SPOOR;
  Master: + LITURGY). No player is assigned a channel that cannot carry a sign
  this expedition.

**R61**: As the server, `FIELD_STARTED` is per-player filtered.
- AC: At DEPLOY, each player's assignment is stored server-side on their
  `ServerPlayerEntry.perceivedChannels` and their `FIELD_STARTED` payload carries
  `signs` filtered to their channels plus their own `perceivedChannels`.
- AC: A player never receives a sign whose `channel` is outside their set.
- AC: A solo player receives every ambient sign (filtering is invisible at size 1).

**R62**: As the server, probe results are per-player filtered on the REACTION
channel.
- AC: Every connected player in the room receives `PROBE_RESULT` with `playerId`,
  `stimulus`, and `exposure` (the probe is visible party behavior).
- AC: Only players whose set contains `REACTION` receive the `sign`; all others
  receive `sign: null` — including the prober, if they cannot read REACTION
  (someone else must watch the response).
- AC: Exposure accrues once per probe regardless of how many players perceive it.

**R63**: As the server, perception survives reconnection and filtering applies to
the resync.
- AC: A player's `perceivedChannels` is keyed to their `playerId`, not their
  socket: after RECONNECT the same player has the same set.
- AC: `buildFieldSnapshot` takes the reconnecting player and returns `signs`
  (ambient + revealed reactions) filtered to that player's channels, plus their
  `perceivedChannels`.
- AC: A reconnecting player who does not perceive REACTION does not receive
  revealed reaction signs in the snapshot.
