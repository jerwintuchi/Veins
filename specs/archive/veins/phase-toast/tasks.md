# Tasks — Phase Transition Notifications

---

- [x] T1 [R1] — Create `PhaseToast` component; wire into `App`.
  Test: `src/client/src/components/PhaseToast.test.tsx` (new)
  - PHASE_CHANGED combat → phase-toast shows 'COMBAT'
  - PHASE_CHANGED loot → phase-toast shows 'FLOOR CLEARED'
  - FLOOR_ADVANCED → phase-toast shows floor number
  - toast auto-dismisses after 2.5s
  - new event while toast showing replaces message and resets timer
