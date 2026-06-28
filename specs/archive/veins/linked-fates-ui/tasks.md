# Tasks — Linked Fates Client UI

---

- [x] T1 [R1] — Handle `RELIC_REMOVED` in `BoardPanel`.
  Test: `src/client/src/components/BoardPanel.test.tsx` (extended)
  - after `RELIC_REMOVED`, slot `relicId` is null in render
  - after `RELIC_REMOVED`, synergy pulse class removed for that slot

- [x] T2 [R2, R3, R4, R5] — Add revive state and UI to `BoardPanel`.
  Test: `src/client/src/components/BoardPanel.test.tsx` (extended)
  - `PLAYER_DOWNED` for teammate: revive-panel visible
  - `PLAYER_DOWNED` for local player: revive-panel NOT shown
  - `PLAYER_REVIVED` for downed teammate: revive-panel hidden
  - clicking revive-btn: data-revive-source slots highlighted (own relic slots)
  - clicking source slot: target hint shown; data-revive-target slots highlighted
  - clicking target slot: socket emits 'revive' with sourceCoord + targetCoord
  - `LINKED_FATES_ERROR`: error message shown in linked-fates-error element
