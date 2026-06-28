# Tasks — Placement Feedback + Empty Tray Hint

---

- [x] T1 [R1, R2] — Add `RELIC_PLACE_ERROR` handler + empty tray hint to `BoardPanel`.
  Test: `src/client/src/components/BoardPanel.test.tsx` (extended)
  - RELIC_PLACE_ERROR shows placement-error with server message
  - placement-error clears when place-relic is emitted (next attempt)
  - placement-error clears on RELIC_PLACED
  - tray-ready-hint visible when lootPool relics are all placed
  - tray-ready-hint NOT shown when relics still available
