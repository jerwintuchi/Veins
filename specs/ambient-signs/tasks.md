# Tasks — Ambient Sign Delivery

> Phase 4, spec 3. T# continues from T49. Ordered: shared types → handler →
> snapshot → tests.

---

- [x] T50 [R49, R51, R52] — Add `signs: Sign[]` to `FieldStartedPayload` in
  `src/shared/src/fieldMessages.ts` and to `FieldSnapshot` in
  `src/shared/src/fieldPhase.ts`. Import `Sign` from `./signs.js` in both files.
  Test: `src/shared/src/fieldMessages.test.ts` and `src/shared/src/fieldPhase.test.ts`
  — verify (a) `FieldStartedPayload` satisfies `{ signs: Sign[] }` (TypeScript
  `satisfies` check); (b) `FieldSnapshot` satisfies `{ signs: Sign[] }`.

- [x] T51 [R49, R50] — Update `handleDeploy` to call `deriveSigns(contract.traitRoll,
  contract.tier)` and include the result as `signs` in the `FIELD_STARTED` payload.
  Test: `src/server/src/rooms/handlers/deploy.test.ts` — verify (a) `FIELD_STARTED`
  payload contains `signs` array; (b) at Apprentice tier, `signs` has 3 elements with
  channels `RESIDUE`, `STRESS_MARK`, `OMEN`; (c) no sign has axis or value keys;
  (d) `JSON.stringify(payload)` contains none of the axis value literals.

- [x] T52 [R51] — Update `buildFieldSnapshot` in `src/server/src/rooms/snapshot.ts`
  to call `deriveSigns` and include `signs` in `FieldSnapshot`. When room is not FIELD
  phase or contract is null, signs is `[]`.
  Test: `src/server/src/rooms/snapshot.test.ts` (new) — verify `buildFieldSnapshot`
  returns a `FieldSnapshot` with a non-empty `signs` array when room is in FIELD phase
  with a valid ContractRecord; returns `null` when phase is WAITING.

- [x] T53 [R49, R50, R51] — Integration test: extend
  `src/server/src/rooms/field.integration.test.ts` Scenario A to assert that
  `FIELD_STARTED` payload includes a `signs` array, and Scenario C (reconnect) to
  assert that `STATE_RESYNC > fieldSnapshot.signs` is a non-empty array matching
  the `FIELD_STARTED` signs.
