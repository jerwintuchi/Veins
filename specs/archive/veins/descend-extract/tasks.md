# Tasks — Descend / Extract Buttons

---

- [x] T1 [R1, R2, R3, R4, R5] — Create `DescendPanel` component; wire into `App`.
  Test: `src/client/src/components/DescendPanel.test.tsx` (new)
  - descend-panel present when phase === 'loot'
  - descend-panel absent when phase === 'combat'
  - descend-btn click emits 'descend'
  - extract-btn click emits 'extract'
  - both buttons disabled after click
  - buttons re-enable on FLOOR_ADVANCED
  - buttons re-enable on RUN_ENDED
  - LOBBY_ERROR shows error text and re-enables buttons
