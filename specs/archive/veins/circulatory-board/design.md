# Design — Circulatory Board

## Data Models
> These types live in `src/shared/src/board.ts`

```typescript
// Axial hex coordinates. Six neighbors at offsets: (±1,0), (0,±1), (+1,-1), (-1,+1)
type HexCoord = { q: number; r: number };

type RelicId = string;   // UUID
type PlayerId = string;  // UUID, matches Supabase auth id

type RelicTag = 'fire' | 'aoe' | 'party' | 'poison' | 'shield' | 'chain';
// Tags are additive; new tags added to this union as relics are designed

type Effect = {
  description: string;
  // Concrete effect data (damage, heal amount, duration, etc.) defined per-relic
};

type Relic = {
  id: RelicId;
  name: string;
  tags: RelicTag[];
  baseEffect: Effect;      // Always active while on board
  synergyEffect: Effect;   // Active only when synergy fires
};

type RelicSlot = {
  coord: HexCoord;
  ownerId: PlayerId;       // Which player "owns" this slot (determines player color in UI)
  relicId: RelicId | null; // null = slot is empty
};

// Key: hexCoordKey(q, r). Lives in src/server/ as a Map; serialized to object for events.
type RelicBoard = {
  slots: Record<string, RelicSlot>; // key = hexCoordKey(coord)
};

// Result of synergy evaluation: which relics currently have synergy active
type SynergyMap = Record<RelicId, boolean>;
```

## Algorithms

### hexCoordKey(coord)
```
input:  HexCoord { q, r }
output: string — canonical key for Map/Record lookup
impl:   `${q},${r}`
```
Pure. Bijective for integer coords. Lives in `src/shared/src/board.ts`.

### hexNeighbors(coord)
```
input:  HexCoord { q, r }
output: HexCoord[6] — the six axial neighbors
offsets: (+1,0), (-1,0), (0,+1), (0,-1), (+1,-1), (-1,+1)
```
Pure. Lives in `src/shared/src/board.ts`.

### evaluateSynergies(board, registry)
```
input:  RelicBoard, Map<RelicId, Relic>
output: SynergyMap — for each relicId on the board, whether synergy is active

for each slot in board.slots:
  if slot.relicId is null: skip
  relic = registry.get(slot.relicId)
  neighbors = hexNeighbors(slot.coord)
  synergyFires = false
  for each neighbor of neighbors:
    neighborSlot = board.slots[hexCoordKey(neighbor)]
    if neighborSlot is undefined: continue
    if neighborSlot.relicId is null: continue
    if neighborSlot.ownerId === slot.ownerId: continue  // same player, no synergy
    neighborRelic = registry.get(neighborSlot.relicId)
    if relic.tags ∩ neighborRelic.tags is non-empty:
      synergyFires = true
      break
  result[relic.id] = synergyFires

return result
```
Pure function. No side effects. Deterministic. Lives in `src/server/src/board/synergy.ts`.

## Correctness Properties

**P1 (Determinism)**: `evaluateSynergies` is a pure function. Given identical `board` and `registry` arguments, it always returns an identical `SynergyMap`. No global state, no `Math.random()`, no `Date.now()`.

**P2 (Owner isolation)**: A relic adjacent only to relics with the same `ownerId` never has `synergy = true` in the result.

**P3 (Mutual synergy)**: If `evaluateSynergies` returns `true` for relic A due to adjacency with relic B, it also returns `true` for relic B due to adjacency with relic A (assuming tags match).

**P4 (Tag specificity)**: Adjacency alone is not sufficient — there must be at least one shared tag between the two relics for synergy to fire.

**P5 (Order independence)**: The evaluation result is identical regardless of the iteration order of `board.slots`.

## Socket.io Events

**BOARD_STATE_SYNC** (server → client, on room join):
```typescript
{
  board: RelicBoard;         // full current board state
  synergyMap: SynergyMap;    // current synergy evaluation result
  relicRegistry: Record<RelicId, Relic>; // all relics on the board
}
```
Sent to the joining socket only.

**RELIC_PLACED** (server → room, after validated placement or Linked Fates transfer):
```typescript
{
  coord: HexCoord;
  relicId: RelicId;
  ownerId: PlayerId;
  synergyMap: SynergyMap;  // full re-evaluated synergy map for all board relics
}
```

**RELIC_REMOVED** (server → room, before a Linked Fates transfer):
```typescript
{
  coord: HexCoord;
  relicId: RelicId;
  reason: 'linked-fates' | 'run-end';
}
```

**RELIC_PLACE_ERROR** (server → requesting socket only):
```typescript
{
  code: 'SLOT_OCCUPIED' | 'WRONG_PHASE' | 'INVALID_COORD';
  message: string;
}
```

## Board Layout (Initial)
The board is pre-defined per run (not procedurally shaped). Starting layout: 19 hexes in a radius-2 hex grid centered at (0,0). Each player is assigned a "home quadrant" of slots at session start. Board shape is identical every run — only relic placements vary.

## Satisfies Requirements
R1, R2, R3, R4, R5, R6, R7

---

## Doctrine Tracking System (R8 – R11)

### Overview

The game tracks four hidden integer scores per run: `sanctumScore`, `tumorScore`,
`chorusScore`, `penitentScore`. These live in server-side `Room` state and are never
sent to the client directly. The client only ever sees the downstream effects of
thresholds being crossed (described below). This satisfies the "no explicit doctrine
UI" principle from the System Design Doc (section 8.1).

---

### Data Model Addition

```typescript
// Extend Room state (src/server/src/room/state.ts)
type DoctrineScores = {
  sanctum:  number;   // accumulates on stable, orderly board behavior
  tumor:    number;   // accumulates on volatile, adaptive behavior
  chorus:   number;   // accumulates on synchronized cross-player behavior
  penitent: number;   // accumulates on sacrifice and restraint behavior
};

// Added to Room:
doctrineScores: DoctrineScores;   // initialized to { sanctum:0, tumor:0, chorus:0, penitent:0 }
dominantDoctrine: Doctrine | null; // null until first threshold crossed; recomputed on each scoring event
```

```typescript
type Doctrine = 'sanctum' | 'tumor' | 'chorus' | 'penitent';
```

`dominantDoctrine` is the doctrine with the highest score, breaking ties by the
order `sanctum > chorus > penitent > tumor` (Sanctum wins ties because it is the
"resting" interpretation when the run is undecided). It is recomputed server-side
on every scoring mutation. It is never broadcast. It is read by the boss-phase
logic (future spec) and the threshold-effect system described below.

---

### Scoring Events

The following server-side events increment doctrine scores. All increments are
applied inside existing handlers with no new socket messages required.

| Trigger | Condition | Score change |
|---------|-----------|-------------|
| `RELIC_PLACED` | Placed relic has tag `sanctum` AND at least one adjacent relic (any owner) also has tag `sanctum` | `sanctum += 2` |
| `RELIC_PLACED` | Placed relic has tag `sanctum`, no adjacent `sanctum` relic | `sanctum += 1` |
| `RELIC_PLACED` | Placed relic has tag `tumor` | `tumor += 2` |
| `RELIC_PLACED` | Placed relic has tag `chorus` AND the placing player's relic is immediately cross-player adjacent | `chorus += 3` |
| `RELIC_PLACED` | Placed relic has tag `chorus`, not cross-player adjacent | `chorus += 1` |
| `PLAYER_DOWNED` (Linked Fates revive) | A revive is completed (relic sacrificed) | `penitent += 3` |
| `RELIC_REMOVED` with `reason: 'linked-fates'` | Any sacrifice event | `penitent += 1` (in addition to the above; stacks) |
| `ENEMY_DIED` | The killing hit came from a `tumor`-tagged relic (checked via board ownership at time of kill) | `tumor += 1` |
| `ENEMY_DIED` | Three or more enemies die within the same 500 ms window (tracked as `recentKillTimestamps` in Room) | `chorus += 2` (awarded once per burst window, not per kill) |
| Voluntary extraction (`extract` event, phase `loot`) | Run extracted normally | `penitent += 4` |
| Forced extraction (Bleed Clock >= 80% at time of extract) | Bleed Clock high at extraction | `tumor += 2` |
| Full wipe (`RUN_ENDED` with `outcome: 'wiped'`) | No scoring -- a wipe does not reward any doctrine |

"Killing hit came from a tumor-tagged relic" is evaluated as: the attacker's
`relicsOwnedBy` set contains at least one relic whose tags include `tumor`. This
is a board-state lookup, no new tracking needed.

`recentKillTimestamps` is a `number[]` appended to on each `ENEMY_DIED` and pruned
to the last 500 ms window before each burst check. It is reset on floor descent.

---

### Score Decay

Scores do not decay mid-run. The system rewards commitment and consistency over
time. Normalisation happens only at read-time (dominant doctrine calculation), where
the raw scores are compared directly. This means early-run choices are gradually
diluted by later choices rather than being wiped -- matching the lore intent that
"the world reacts with delay."

If a future balance pass requires decay, the correct form is a multiplicative
floor-descent penalty: on `FLOOR_ADVANCED`, multiply all four scores by 0.85 and
floor to integer. This preserves relative proportions while ensuring early runs do
not permanently over-determine doctrine. Do not implement this in v1; note here for
the balance spec.

---

### Threshold Effects (v1, no art assets required)

Thresholds are checked after every scoring event. A threshold fires at most once
per run (tracked by `doctrineThresholdsFired: Set<string>` on Room, where each
string is `"${doctrine}-${tier}"`).

#### Sanctum -- "Stable Form"

| Threshold | Effect |
|-----------|--------|
| `sanctumScore >= 8` (Tier 1) | Bleed Clock drain rate reduced by 10% for the remainder of the run. Implemented by multiplying the per-floor `drainRate` constant by 0.9 at the point of threshold crossing. No new event needed; next `BLEED_CLOCK_TICK` will naturally reflect the lower rate. |
| `sanctumScore >= 18` (Tier 2) | `BOARD_DOCTRINE_SHIFT` event emitted (see below). Server message text: "The Veins grow still. Stability recognized." |

#### Tumor -- "Constant Becoming"

| Threshold | Effect |
|-----------|--------|
| `tumorScore >= 8` (Tier 1) | Enemy aggression multiplier increased by 15% for the remainder of the run (`enemyAttackSpeedMultiplier` on Room, read by `tickEnemies`). Higher aggression means faster Bleed Clock pressure and bigger kill burst opportunities -- fits the doctrine's risk/reward identity. |
| `tumorScore >= 18` (Tier 2) | `BOARD_DOCTRINE_SHIFT` event emitted. Server message text: "The Veins convulse. Mutation acknowledged." |

#### Chorus -- "Collective Mind"

| Threshold | Effect |
|-----------|--------|
| `chorusScore >= 8` (Tier 1) | Ward-stone and party-tag relic reductions are doubled for the remainder of the run (server multiplies all `wardReduction` constants by 2 for this room). No new event; the change is silent until next hit. |
| `chorusScore >= 18` (Tier 2) | `BOARD_DOCTRINE_SHIFT` event emitted. Server message text: "The Veins resonate. Unity recognized." |

#### Penitent -- "Surrender"

| Threshold | Effect |
|-----------|--------|
| `penitentScore >= 8` (Tier 1) | The next Linked Fates revive costs no relic (one-time free revive, tracked as `penitentFreeRevive: boolean` on Room). The flag is consumed on the next revive and does not refresh. |
| `penitentScore >= 18` (Tier 2) | `BOARD_DOCTRINE_SHIFT` event emitted. Server message text: "The Veins weep. Sacrifice recognized." |

---

### New Delta Event: BOARD_DOCTRINE_SHIFT

This is the only new socket event the doctrine system introduces. It carries
only a text message -- no doctrine name, no score, no numbers. The client
displays it as a transient toast (same mechanism as `PhaseToast`).

```typescript
// Emitted: server → room (broadcast to all players)
type BoardDoctrineShiftEvent = {
  message: string;   // flavor text only, e.g. "The Veins grow still. Stability recognized."
};
```

The event name is `'board-doctrine-shift'`. It is emitted at most twice per
doctrine per run (once per tier), and at most once per tier-crossing (guarded by
`doctrineThresholdsFired`).

The client is not told *which* doctrine fired. Players must infer from context.
This is intentional.

---

### Requirements

**R8 (Sanctum Scoring)**: As the game system, when players consistently place
Sanctum-tagged relics, the Bleed Clock drain rate decreases and a flavor toast
appears, rewarding stable play without showing a score.
- AC: Placing a `sanctum`-tagged relic increments `room.doctrineScores.sanctum` by
  1 or 2 depending on adjacency to another sanctum relic (not just any relic)
- AC: When `sanctumScore` first reaches 8, the room's effective drain rate is
  multiplied by 0.9 and the threshold is marked as fired (idempotent)
- AC: When `sanctumScore` first reaches 18, `BOARD_DOCTRINE_SHIFT` is broadcast
  with the Sanctum flavor text
- AC: Neither threshold fires a second time in the same run

**R9 (Tumor Scoring)**: As the game system, when players accumulate kills through
Tumor-tagged relics or extract under pressure, enemy aggression increases,
reflecting the doctrine of chaos rewarding itself.
- AC: An `ENEMY_DIED` event where the killing player owns a `tumor`-tagged relic
  increments `tumorScore` by 1
- AC: A forced extraction (Bleed Clock >= 80%) increments `tumorScore` by 2
- AC: When `tumorScore` first reaches 8, `room.enemyAttackSpeedMultiplier` is set
  to 1.15 and the threshold is marked fired (idempotent)
- AC: When `tumorScore` first reaches 18, `BOARD_DOCTRINE_SHIFT` is broadcast
  with the Tumor flavor text

**R10 (Chorus Scoring)**: As the game system, when players achieve coordinated
kills and cross-player relic adjacency, party-relic protection scales up,
rewarding team synchronization.
- AC: Placing a `chorus`-tagged relic scores `chorusScore += 3` when it is
  immediately cross-player adjacent, else `+= 1`
- AC: When three or more enemies die within 500 ms, `chorusScore += 2` (once per
  burst window; the window is measured from the first kill in the burst)
- AC: When `chorusScore` first reaches 8, the ward-stone protection values used by
  `evaluateIncomingDamage` are doubled for that room (idempotent)
- AC: When `chorusScore` first reaches 18, `BOARD_DOCTRINE_SHIFT` is broadcast
  with the Chorus flavor text

**R11 (Penitent Scoring)**: As the game system, when players sacrifice relics via
Linked Fates or extract voluntarily, they are rewarded with a free revive token,
acknowledging restraint and surrender as valid strategies.
- AC: Completing a Linked Fates revive (relic sacrificed successfully) increments
  `penitentScore` by 4 (3 for the revive + 1 for the `RELIC_REMOVED` event)
- AC: A voluntary extraction (extract event, Bleed Clock < 80%) increments
  `penitentScore` by 4
- AC: When `penitentScore` first reaches 8, `room.penitentFreeRevive` is set to
  `true`; the next revive skips the relic-sacrifice check and sets the flag to
  `false`
- AC: When `penitentScore` first reaches 18, `BOARD_DOCTRINE_SHIFT` is broadcast
  with the Penitent flavor text

---

## Relic Registry — Doctrine-Tagged Existing Relics

The following doctrine tags should be added to each relic in `src/shared/src/relics.ts`.
The `RelicTag` union in `src/shared/src/board.ts` must be extended with
`'sanctum' | 'tumor' | 'chorus' | 'penitent'` before these are applied.

| Relic ID | Doctrine Tag to Add | Rationale |
|----------|--------------------|-----------| 
| `ember-core` | `tumor` | Explosive spread is volatile and adaptive |
| `torch-brand` | `tumor` | Contagion/spread is the Tumor identity |
| `ember-sage` | `sanctum` | Requires deliberate setup; predictable reward |
| `arc-bolt` | `chorus` | Chaining links targets; cross-player synergy required |
| `chain-link` | `chorus` | Propagation through a network of targets |
| `storm-coil` | `chorus` | Coordination relic in the chain cluster |
| `iron-skin` | `sanctum` | Flat unconditional reduction; pure structural defense |
| `shard-skin` | `sanctum` | Rewards deliberate shield-wall board arrangement |
| `ward-stone` | `chorus` | Effect directed at teammates only |
| `void-lens` | (none -- neutral) | Crossroads of precision and AOE; no doctrine identity |
