# Tasks — Post-Run Screen

---

- [x] T1 [R1, R2, R3] — Create `PostRunScreen` component and wire `RUN_ENDED`
  in `App`.
  Test: `src/client/src/components/PostRunScreen.test.tsx` (new) +
        `src/client/src/App.test.tsx` (extended)
  - `PostRunScreen` shows 'WIPED' for wiped outcome
  - `PostRunScreen` shows 'EXTRACTED' for extracted outcome
  - `PostRunScreen` shows the final floor number
  - clicking return-to-lobby-btn calls onReturnToLobby
  - `App`: `RUN_ENDED` → post-run-screen visible, game canvas gone
  - `App`: clicking return-to-lobby-btn → lobby-screen visible
