# Requirements — Real Contract Generation

> Phase 4, spec 2. Replaces the `StubContract` placeholder with a real `ContractRecord`
> that embeds a server-side `TraitRoll` and an expedition seed. Depends on spec 1
> (Incarnate Trait Schema & Sign Language). No probing or sign delivery in this spec —
> only the data model and the `ACCEPT_CONTRACT` handler update.
>
> R# numbering continues from R41 (incarnate-signs spec).

---

## Functional Requirements

**R42**: As the server, accepting a contract generates a `ContractRecord` — a server-only
record containing a real `TraitRoll` (from spec 1), an expedition seed, and v1 contract
axes (target name, site name, primary verb, tier).
- AC: `ContractRecord` is a server-only type that extends `ContractIntel` with two
  additional fields: `expeditionSeed: string` and `traitRoll: TraitRoll`.
- AC: `ContractRecord` is never exported from `@testament/shared`.

**R43**: As the shared wire protocol, `ContractIntel` is the client-visible portion of
a contract — it has `contractId`, `tier: Tier`, `targetName`, `siteName`, and
`primaryVerb: PrimaryVerb`, but no `expeditionSeed` or `traitRoll`.
- AC: `ContractIntel` is exported from `@testament/shared` and replaces `StubContract`
  in all shared types (`LobbySnapshot.contract`, `RoomDeployingPayload.contract`).
- AC: `PrimaryVerb` is a shared union of exactly 4 string literals:
  `'INVESTIGATE' | 'ELIMINATE' | 'CAPTURE' | 'BANISH'`.

**R44**: As the server, `generateContract(rng, tier, contractId, expeditionSeed): ContractRecord`
is a pure function — it receives all randomness through `rng.pick()` and uses the provided
`contractId` and `expeditionSeed` without generating new entropy itself.
- AC: Same `rng` seed + same `tier` + same `contractId` + same `expeditionSeed` always
  produces the same `ContractRecord`.
- AC: `generateContract` uses only `rng.pick()` for randomness; it does not call
  `Math.random()`, `crypto.randomUUID()`, or import from `node:crypto`.

**R45**: As the server, the `ACCEPT_CONTRACT` handler generates a new expedition seed and
contract ID via `node:crypto`'s `randomUUID()`, then delegates all other randomness to a
seeded `Rng` derived from the expedition seed.
- AC: `room.contract` is set to the full `ContractRecord` (not just the intel).
- AC: The `ROOM_DEPLOYING` broadcast carries only `ContractIntel` (stripped of
  `expeditionSeed` and `traitRoll`).

**R46**: As the server, `toContractIntel(contract: ContractRecord): ContractIntel` is a
pure helper that strips server-only fields and returns the wire-safe view.
- AC: The returned object has exactly the fields of `ContractIntel` and no others.
- AC: `toSnapshot` in `snapshot.ts` calls `toContractIntel` before including the contract
  in a `LobbySnapshot` (so no client-facing path exposes `traitRoll` or `expeditionSeed`).

**R47**: As the server, the v1 generation pools are:
- Target names: 4 entries (e.g., `'The Ashen Warden'`, `'The Weeping Mire'`, etc.)
- Site names: 4 entries (e.g., `'The Collapsed Chancel'`, `'The Salt Marsh'`, etc.)
- Primary verbs: all 4 `PrimaryVerb` values.
- AC: `generateContract` picks from these pools using `rng.pick()`.
- AC: Calling `generateContract` with two separately seeded RNG instances from the same
  seed produces the same contract axes and the same embedded `TraitRoll`.

---

## Correctness Requirements

**R48**: As the server, the `expeditionSeed` and `traitRoll` fields of `ContractRecord`
must never appear in any emitted event payload.
- AC: `JSON.stringify` of any `ROOM_DEPLOYING`, `LOBBY_UPDATED`, or `STATE_RESYNC`
  payload contains neither `"expeditionSeed"` nor `"traitRoll"` as a key.
- AC: `toContractIntel` removes both fields by destructuring or equivalent (runtime
  `Object.keys` on the result does not include `expeditionSeed` or `traitRoll`).
