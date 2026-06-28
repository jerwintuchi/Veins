# Solo Play — Tasks

All tasks must satisfy: R# cited → test named → implementation → mark done.

---

- [x] T1 [R1] — Lower `MIN_PLAYERS_TO_START` from 2 to 1 in `src/shared/src/lobby.ts`.
  Test: `src/shared/src/lobby.test.ts` — `expect(MIN_PLAYERS_TO_START).toBe(1)`.

- [x] T2 [R2, R3, P1, P2] — Relax the owner check for single-owner boards in
  `src/server/src/board/synergy.ts`.
  Test: `src/server/src/board/synergy.test.ts`
  - solo board (one owner): adjacent shared-tag relics BOTH synergize (R2)
  - solo board: adjacent relics with no shared tag still do not synergize (R2)
  - co-op board (≥2 owners): same-owner adjacency does NOT synergize (R3)
  - co-op board: different-owner shared-tag adjacency DOES synergize (R3)
  - determinism holds for a solo board (P2)

- [x] T3 [R1] — Allow solo start in `src/server/src/room/manager.ts` (gate now `< 1`);
  reframe the `DEV_MIN_PLAYERS` comment.
  Test: `src/server/src/room/manager.test.ts` — a 1-player room `startRun` returns
  `{ ok: true }` and yields an in-progress, fully-owned board.

- [x] T4 [R4] — `WaitingRoom` lets a lone host start solo; add a solo hint.
  Test: `src/client/src/components/WaitingRoom.test.tsx` — with one player, `start-run-btn`
  is enabled and no "need more players" hint shows; a solo hint is present.
