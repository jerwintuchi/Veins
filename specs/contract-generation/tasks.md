# Tasks — Real Contract Generation

> Phase 4, spec 2. T# numbering continues from T44 (incarnate-signs spec). Ordered:
> shared types → server types → pure functions → handler update → integration.
> Every task names its test file before implementation.

---

## Shared Types

- [x] T45 [R43, P17, P19] — Define `PrimaryVerb` and `ContractIntel` in
  `src/shared/src/contract.ts`. Export from `src/shared/src/index.ts`. Remove
  `StubContract` from `src/shared/src/lobby.ts`; update `LobbySnapshot.contract` to
  `ContractIntel | null`. Update `RoomDeployingPayload.contract` in `lobbyMessages.ts`
  to `ContractIntel`. Remove the `StubContract` import everywhere in shared.
  Test: `src/shared/src/contract.test.ts` — verifies (a) `PrimaryVerb` is a union of
  exactly 4 literals (`'INVESTIGATE'`, `'ELIMINATE'`, `'CAPTURE'`, `'BANISH'`) — exhaustive
  switch; (b) `ContractIntel` has exactly the fields `contractId`, `tier`, `targetName`,
  `siteName`, `primaryVerb` — `satisfies` check; (c) `ContractIntel` has no
  `expeditionSeed` or `traitRoll` field — compile-time `@ts-expect-error` assertion.

---

## Server: Contract Record

- [x] T46 [R42, P19] — Define server-only `ContractRecord` type in
  `src/server/src/incarnate/contractRecord.ts` as `ContractIntel & { expeditionSeed: string; traitRoll: TraitRoll }`.
  Test: `src/server/src/incarnate/contractRecord.test.ts` — verifies (a) `ContractRecord`
  is assignable from an object that includes all `ContractIntel` fields plus
  `expeditionSeed` and `traitRoll` (structural `satisfies` check); (b) the module does
  not export from `@testament/shared` (no re-export of `ContractRecord` into shared).

---

## Server: Pure Functions

- [x] T47 [R44, R47, P18] — Implement `generateContract(rng, tier, contractId, expeditionSeed): ContractRecord`
  and `toContractIntel(contract: ContractRecord): ContractIntel` in
  `src/server/src/incarnate/generateContract.ts`. `generateContract` calls
  `generateTraitRoll(rng, tier)` internally; `toContractIntel` destructs the two
  server-only fields.
  Test: `src/server/src/incarnate/generateContract.test.ts` — verifies (a) same seed →
  same `ContractRecord` output (determinism — two `createRng(hashSeed(seed))` calls);
  (b) `targetName` falls within the 4-entry pool; `siteName` within the 4-entry pool;
  `primaryVerb` within the 4 `PrimaryVerb` literals; (c) embedded `traitRoll` is a
  valid Apprentice roll (has `aspect`, `frailty`, `tell`; no `ward` or `disposition`
  at Apprentice); (d) the source file for `generateContract` does not import
  `node:crypto` or call `Math.random` (static check); (e) `toContractIntel` output has
  exactly five keys (`contractId`, `tier`, `targetName`, `siteName`, `primaryVerb`) and
  no `expeditionSeed` or `traitRoll` (`Object.keys` check — P17/R48).

---

## Server: Handler & Snapshot Updates

- [x] T48 [R45, R46, P19] — Update `handleAcceptContract` to call `generateContract`
  (entropy via `randomUUID()` for seed/id; RNG from `createRng(hashSeed(seed))`).
  Update `toSnapshot` in `snapshot.ts` to call `toContractIntel` before returning.
  Update `buildStubFieldData` in `fieldData.ts` to accept `ContractIntel` instead of
  `StubContract`. Update `RoomRecord.contract` in `types.ts` to `ContractRecord | null`.
  Delete `src/server/src/rooms/stubContract.ts`.
  Test: Existing `src/server/src/rooms/handlers/acceptContract.test.ts` — add assertions
  that (a) `room.contract` is set after `handleAcceptContract`; (b) the broadcast
  payload's `contract` key does not contain `expeditionSeed` or `traitRoll`; (c)
  `room.contract` has `traitRoll` (server-side) but the broadcast payload does not.

---

## Integration

- [x] T49 [R45, R46, R47, R48, P17, P18, P19] — Extend `lobby.integration.test.ts`
  with a scenario verifying that after `ACCEPT_CONTRACT`, the emitted `ROOM_DEPLOYING`
  payload is a valid `ContractIntel` (no `expeditionSeed`, no `traitRoll`, correct
  `PrimaryVerb` value, `tier` is a `Tier` string not a number).
