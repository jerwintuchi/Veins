# Design — Distributed Perception

> Satisfies R59–R63. P# numbering continues from P24 (probe-handler spec).
>
> Spine verb: **Observe** (who can observe what) in service of Pillar 4: evidence
> is distributed, so the theory can only be assembled by talking. Filtering is
> server-side; the client never receives what its player cannot perceive — this is
> information security, not UI hiding (I5).

---

## Data models

### Shared (`@testament/shared` — types and constants only, I4)

```ts
// src/shared/src/signs.ts (addition)
export const CHANNELS: ReadonlyArray<Channel> =
  ['RESIDUE', 'STRESS_MARK', 'REACTION', 'SPOOR', 'LITURGY', 'OMEN'];

// src/shared/src/fieldMessages.ts (changes)
export type FieldStartedPayload = {
  fieldData:          StubFieldData;
  reconnectToken:     string;
  signs:              Sign[];      // ambient signs, filtered to this player's channels
  perceivedChannels:  Channel[];   // this player's own perception set
};
export type ProbeResultPayload = {
  playerId: string;
  stimulus: Stimulus;
  sign:     Sign | null;  // null = "you cannot read the Reaction channel" (≠ no-reaction)
  exposure: number;
};

// src/shared/src/fieldPhase.ts (change)
export type FieldSnapshot = {
  fieldData:          StubFieldData;
  archiveEntries:     StubArchiveEntry[];
  signs:              Sign[];      // ambient + revealed reactions, filtered to this player
  perceivedChannels:  Channel[];
};
```

A player learns only their **own** perception set. Party knowledge of who reads
what is assembled by talking, like the read itself.

### Server-only

```ts
// src/server/src/rooms/types.ts (ServerPlayerEntry addition)
perceivedChannels: Channel[];   // empty until DEPLOY assigns; keyed to playerId, not socket

// src/server/src/rooms/perception.ts
export const MIN_CHANNELS_PER_PLAYER = 2;
```

## Algorithms

### `channelsForTier(tier: Tier): Channel[]`
Pure (`src/server/src/rooms/perception.ts`). The channels that can carry a sign
this expedition: the channels of `AMBIENT_AXES[tier]` plus `REACTION`
(probe-gated), in canonical `CHANNELS` order.

- APPRENTICE → `[RESIDUE, STRESS_MARK, REACTION, OMEN]`
- JOURNEYMAN → `[RESIDUE, STRESS_MARK, REACTION, SPOOR, OMEN]`
- MASTER     → `[RESIDUE, STRESS_MARK, REACTION, SPOOR, LITURGY, OMEN]`

### `assignPerception(rng: Rng, playerIds: string[], channels: Channel[]): Map<string, Channel[]>`
Pure and deterministic given the rng (`src/server/src/rooms/perception.ts`).
Interim assignment until the loadout economy replaces the source (the filtering
machinery stays).

1. Solo (`playerIds.length === 1`): the player gets all `channels`.
2. Otherwise: Fisher–Yates-shuffle a copy of `channels` with `rng`; deal
   round-robin to players (union = all channels — full read always assemblable).
3. While any player has fewer than `MIN_CHANNELS_PER_PLAYER` channels, deal them
   the next channel from the shuffled list (wrapping, skipping ones they already
   hold). This creates deliberate overlap at party sizes where
   `channels.length < 2 × players` (e.g. 4 Seekers at Apprentice: 4 channels →
   every channel is held by two players).
4. Each player's list is sorted into canonical `CHANNELS` order before return.

The rng is seeded from `hashSeed(expeditionSeed + ':perception')` in the DEPLOY
handler — a domain-suffixed sub-seed, so the assignment neither replays nor
disturbs the contract-generation sequence (I3: same expedition seed → same
assignment, always).

### `filterSigns(signs: Sign[], channels: Channel[]): Sign[]`
Pure one-liner in `perception.ts`: keeps signs whose `channel` is in the set,
preserving order.

### `handleDeploy` (changes)
After building ambient signs: seed the perception rng, call `assignPerception`
with the room's playerIds (join order) and `channelsForTier(contract.tier)`,
store each player's set on their `ServerPlayerEntry.perceivedChannels`, and emit
each player's `FIELD_STARTED` with `signs: filterSigns(ambient, player set)` and
their `perceivedChannels`.

### `handleProbe` (changes)
Broadcast is replaced by per-player delivery (`emitTo`), because the payload now
differs per receiver:

- exposure and `revealedSigns` mutate exactly once (unchanged);
- every player in the room receives `PROBE_RESULT { playerId, stimulus, exposure }`;
- players whose set contains `REACTION` get `sign`; everyone else gets
  `sign: null`. The prober is not special-cased: if they cannot read REACTION,
  they rang the bell blind.

Disconnected players simply miss the emit (stale socketId); they recover revealed
reactions via the snapshot on reconnect **iff** they perceive REACTION.

### `buildFieldSnapshot(room, archive, playerId)` (changes)
Looks up the player's `perceivedChannels`, returns
`signs: filterSigns([...ambient, ...revealedSigns], set)` and
`perceivedChannels`. Assignment is keyed to `playerId` (the reconnect handler
already resolves the player entry by `playerId`), so the set survives socket
churn (R63).

## Wire protocol

| Direction | Type | Change |
|-----------|------|--------|
| S → player | `FIELD_STARTED` | `signs` filtered per player; `+ perceivedChannels: Channel[]` |
| S → player | `PROBE_RESULT` | per-player emit; `sign: Sign \| null` (null for non-perceivers) |
| S → player | `STATE_RESYNC` | `fieldSnapshot.signs` filtered; `+ fieldSnapshot.perceivedChannels` |

No new message types, no new error codes. Trait rolls still never cross the wire.

## Correctness properties

- **P25 — Determinism**: same rng seed + same ordered playerIds + same channels →
  identical assignment, always. [R60]
- **P26 — Coverage**: the union of assigned sets equals the input channels at
  every party size 1–4. [R60]
- **P27 — Completeness per Seeker**: every player holds ≥ `MIN_CHANNELS_PER_PLAYER`
  channels (all of them when solo); solo filtering is a no-op. [R60, R61]
- **P28 — Filter containment**: no payload delivered to a player contains a sign
  whose channel is outside that player's set — ambient, probe result, or
  snapshot. [R61, R62, R63]
- **P29 — Stability**: a player's set is identical before disconnect and after
  reconnect within one expedition. [R63]
