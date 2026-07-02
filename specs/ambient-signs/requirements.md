# Requirements — Ambient Sign Delivery

> Phase 4, spec 3. Delivers the observable Signs for an expedition to every player
> when the field phase begins. Depends on spec 1 (deriveSigns) and spec 2
> (ContractRecord carries the TraitRoll). No per-player channel filtering in this
> spec — all players receive all signs for the contract tier. That comes in spec 5
> (Distributed Perception).
>
> R# numbering continues from R48 (contract-generation spec).

---

## Functional Requirements

**R49**: As the server, when `FIELD_STARTED` is emitted to each player, the payload
includes a `signs: Sign[]` array derived from the expedition's `TraitRoll` at the
contract's `Tier`.
- AC: The `signs` field is present in every `FIELD_STARTED` payload.
- AC: At Apprentice tier, `signs` has exactly 3 elements with channels
  `RESIDUE`, `STRESS_MARK`, `OMEN` in that order.
- AC: No element of `signs` has an `axis`, `value`, or `traitRoll` field.
  `Object.keys(sign)` equals `['channel', 'token']` for every sign.

**R50**: As the server, signs in `FIELD_STARTED` must never expose the underlying
`TraitRoll` or any axis value literal.
- AC: `JSON.stringify(payload)` does not contain any axis value literal (e.g.,
  `'EMBER'`, `'FLAME'`, `'LUNGE'`).
- AC: The `payload` object has no `traitRoll` or `expeditionSeed` key.

**R51**: As the server, a player reconnecting during the FIELD phase receives the
same signs via `STATE_RESYNC > fieldSnapshot.signs`.
- AC: `FieldSnapshot.signs` is a `Sign[]` of the same length and content as
  the `FIELD_STARTED` payload for the same expedition.
- AC: `buildFieldSnapshot` calls `deriveSigns` with the room's `ContractRecord`
  when the room is in FIELD phase.

**R52**: As the shared wire protocol, `FieldStartedPayload.signs` is typed as
`Sign[]` and `FieldSnapshot.signs` is typed as `Sign[]`.
- AC: Both types are updated in `src/shared/src/fieldMessages.ts` and
  `src/shared/src/fieldPhase.ts` respectively.
- AC: Neither type exposes `TraitRoll`, `TraitAxis`, or any axis value.
