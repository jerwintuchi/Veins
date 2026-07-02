# Design — PROBE Handler

> Satisfies R53–R58. P# numbering continues from P19 (contract-generation spec).
>
> Spine verb: **Test**. A probe is the party betting exposure on a hypothesis about
> the Ward. The server computes the reaction from the hidden trait roll; the wire
> carries only the Sign (CLAUDE.md invariant 3, netcode I5).

---

## Data models

### Shared (`@testament/shared` — types and constants only, I4)

```ts
// src/shared/src/signs.ts (additions)
export type Stimulus = 'FLAME' | 'COLD' | 'SALT' | 'LIGHT';
export const STIMULI: ReadonlyArray<Stimulus> = ['FLAME', 'COLD', 'SALT', 'LIGHT'];

// src/shared/src/fieldMessages.ts (additions)
export type ProbePayload = { stimulus: Stimulus };                    // client → server
export type ProbeResultPayload = {                                     // server → client
  playerId: string;    // who probed (party sees who spent the exposure)
  stimulus: Stimulus;  // echo of the client-chosen stimulus (party behavior, not trait data)
  sign:     Sign;      // the reaction: a lexicon REACTION sign or the no-reaction sign
  exposure: number;    // room exposure after this probe (party noise, not Incarnate knowledge)
};
```

`Stimulus` shares its literals with the server-only `WardValue` by design — a
stimulus is something the party applies (fire, cold, salt, light), and wards are
defined against the same elements. The type itself lives in shared and carries no
trait semantics; `WardValue` stays server-only.

`exposure` as a wire number does not violate "no knowledge as a number"
(vision.md non-negotiable 2): that rule forbids numeric knowledge *about the
Incarnate*. Exposure measures the party's own noise (TD-004 pressure is a
consequence of behavior) and is the cost readout that makes probing a decision.

### Server-only

```ts
// src/server/src/rooms/types.ts (RoomRecord additions)
exposure:      number;   // field pressure accrued by party behavior; reset to 0 on DEPLOY
revealedSigns: Sign[];   // reaction signs revealed by probes this expedition, deduped by token

// src/server/src/incarnate/deriveReaction.ts
export const NO_REACTION_SIGN: Sign = { channel: 'REACTION', token: 'no-reaction' };
export const PROBE_EXPOSURE_COST = 1;
```

## Algorithms

### `deriveReaction(traits: TraitRoll, tier: Tier, stimulus: Stimulus): Sign`
Pure, server-only (`src/server/src/incarnate/deriveReaction.ts`).

1. If `WARD` ∉ `ACTIVE_AXES[tier]` → return `NO_REACTION_SIGN` (Apprentice
   contracts have no ward; the probe is legal but reveals nothing).
2. If `traits.ward === stimulus` → look up the `SIGN_LEXICON` entry with
   `axis === 'WARD' && value === stimulus`; return its `{ channel, token }`.
   Missing entry throws (lexicon completeness is already tested, T44).
3. Otherwise → return `NO_REACTION_SIGN`.

A non-matching probe deliberately returns the *same* sign as a ward-less
Incarnate: a null result is ambiguous evidence, and disambiguating it (probe the
other stimuli? trust the tier?) is the interpretation work the game is about.

### `deriveAmbientSigns(traits: TraitRoll, tier: Tier): Sign[]`
Pure, server-only (`src/server/src/incarnate/deriveSigns.ts`, alongside
`deriveSigns`). Identical to `deriveSigns` but iterates `AMBIENT_AXES[tier]` —
`ACTIVE_AXES[tier]` minus `WARD` — so the REACTION channel never ships ambiently:

```ts
// src/server/src/incarnate/types.ts (addition)
export const AMBIENT_AXES: Record<Tier, ReadonlyArray<TraitAxis>> = {
  APPRENTICE: ['ASPECT', 'FRAILTY', 'TELL'],
  JOURNEYMAN: ['ASPECT', 'FRAILTY', 'TELL', 'DISPOSITION'],
  MASTER:     ['ASPECT', 'FRAILTY', 'TELL', 'DISPOSITION', 'RITE_KEY'],
};
```

`deriveSigns` itself is unchanged (it remains "all active signs" and is still the
lexicon-completeness reference); callers change: `handleDeploy` and
`buildFieldSnapshot` switch to `deriveAmbientSigns`.

### `handleProbe(socketId, payload, roomManager, emit, broadcast): void`
`src/server/src/rooms/handlers/probe.ts`. Standard intent-validation skeleton
(netcode checklist):

1. **Validate shape**: `validatePayload<ProbePayload>(payload, { stimulus: { type: 'string' } })`,
   then `STIMULI.includes(stimulus)`. Failure → `LOBBY_ERROR { code: 'INVALID_PAYLOAD' }`
   to sender only; return.
2. **Authorize**: `assertPhase(room, 'FIELD', emit)` (emits `NOT_IN_ROOM` when
   the socket has no room, `WRONG_PHASE` when the phase is wrong; returns false
   either way). Any player in the room may probe — no leader check.
3. **Mutate** (synchronous): `room.exposure += PROBE_EXPOSURE_COST`; compute
   `sign = deriveReaction(room.contract.traitRoll, room.contract.tier, stimulus)`;
   if `sign.token` is not already in `room.revealedSigns`, push it.
4. **Broadcast** the delta (I6): `PROBE_RESULT` with
   `{ playerId, stimulus, sign, exposure }` to the whole room.

### Reconnect path
`buildFieldSnapshot` returns
`signs: [...deriveAmbientSigns(traitRoll, tier), ...room.revealedSigns]`, so a
reconnecting player recovers exactly what the room has learned (I6 resync).

## Wire protocol

| Direction | Type | Payload |
|-----------|------|---------|
| C → S | `PROBE` | `{ "stimulus": "FLAME" \| "COLD" \| "SALT" \| "LIGHT" }` |
| S → room | `PROBE_RESULT` | `{ "playerId": "…", "stimulus": "FLAME", "sign": { "channel": "REACTION", "token": "drinks-flame" }, "exposure": 3 }` |
| S → sender | `LOBBY_ERROR` | existing codes `INVALID_PAYLOAD`, `NOT_IN_ROOM`, `WRONG_PHASE` — no new codes |

Signs cross the wire; trait rolls never do.

## Correctness properties

- **P20 — Purity/determinism**: `deriveReaction(roll, tier, stimulus)` returns an
  identical `Sign` for identical inputs; it reads no state and mutates nothing. [R55]
- **P21 — Trait containment**: no `PROBE_RESULT` payload contains a `traitRoll`,
  `ward`, or `expeditionSeed` key, and its JSON contains no axis value literal
  other than the echoed client-chosen `stimulus`. A miss is indistinguishable from
  no-ward. [R56]
- **P22 — Probe-gated Reaction**: no ambient sign array (`FIELD_STARTED.signs`,
  the ambient portion of `FieldSnapshot.signs`) contains `channel: 'REACTION'` at
  any tier. [R58]
- **P23 — Exposure monotonicity**: a successful probe increases `room.exposure` by
  exactly `PROBE_EXPOSURE_COST`; a rejected probe changes no room state and emits
  no broadcast. [R54, R57]
- **P24 — Resync completeness**: after any sequence of probes,
  `buildFieldSnapshot(room).signs` = ambient signs ++ every distinct revealed
  reaction sign, deduped by token. [R58]
