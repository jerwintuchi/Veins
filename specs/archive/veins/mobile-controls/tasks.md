# Tasks — Mobile Controls + Auto-Aim

Order: shared types first, then server pure function + room extension, then socket
wiring, then client setup (index.html, vite.config, App.tsx, useSocket), then the
VirtualJoystick component.

---

- [x] T1 [R4] — Add `AimState` to `src/shared/src/combat.ts`; export from index.
  Test: `src/shared/src/combat.test.ts` (extended)
  - `AimState` compiles under strict mode with both `auto` and `manual` variants
  - discriminated union: `auto` has `targetId: string | null`; `manual` has `dx: number, dy: number`
  - `PLAYER_MAX_HP`, `PLAYER_SPEED`, `ENEMY_TYPES` etc. still exported (no regressions)

- [x] T2 [R7] — Add `PlayerAimChangedEvent` to `src/shared/src/events.ts`; export
  from index.
  Test: `src/shared/src/events.test.ts` (extended)
  - `PlayerAimChangedEvent` compiles with `playerId`, `mode`, optional `targetId`,
    optional `dx`, optional `dy`
  - existing event types still compile (no regressions)

- [x] T3 [R4] — Add `aimStates: Map<PlayerId, AimState>` to `Room` in
  `src/server/src/room/state.ts`. Initialize in `RoomManager.startRun` with
  `mode: 'auto', targetId: null` for every player.
  Test: `src/server/src/room/state.test.ts` (extended)
  - a freshly started room has an `aimStates` map with one entry per player
  - each entry has `mode === 'auto'` and `targetId === null`
  - existing Room fields are unchanged (no regressions)

- [x] T4 [R5, P1, P2] — Implement `selectAutoAimTarget` and `AUTO_AIM_RANGE` in
  `src/server/src/combat/autoAim.ts`.
  Test: `src/server/src/combat/autoAim.test.ts`
  - returns `null` when enemy map is empty
  - returns `null` when all enemies are dead
  - returns `null` when no alive enemy is within `AUTO_AIM_RANGE`
  - returns the `id` of the nearest alive enemy within range
  - when two enemies are equidistant, returns consistently (Map insertion order)
  - same inputs produce the same output (deterministic / P2)
  - does not mutate the input map

- [x] T5 [R6, R7, P1, P4] — Add the `aim-player` socket handler in
  `src/server/src/index.ts`.
  Test: `src/server/src/combat/tickLoop.test.ts` (extended)
  - malformed payload (missing `dx` or non-numeric) emits targeted `LOBBY_ERROR`
    (code `INVALID_REQUEST`) and does not broadcast
  - socket not in a room emits targeted `LOBBY_ERROR` and does not broadcast
  - zero vector `{ dx: 0, dy: 0 }` sets player's aim state to `mode: 'auto'`
    and emits `PLAYER_AIM_CHANGED` with `mode: 'auto'` to the room
  - non-zero vector sets state to `mode: 'manual'` with normalized `dx/dy` and
    emits `PLAYER_AIM_CHANGED` with `mode: 'manual'` to the room
  - sending the same aim state twice only emits one `PLAYER_AIM_CHANGED`
    (no duplicate delta events, P3)
  - the stored `dx/dy` for a manual aim vector has magnitude 1.0 (P4)

- [x] T6 [R8, P3, P5] — Integrate auto-aim refresh into `runCombatTick` in
  `src/server/src/index.ts`.
  Test: `src/server/src/combat/tickLoop.test.ts` (extended)
  - after a tick where an enemy enters AUTO_AIM_RANGE, a player in auto mode has
    their `aimStates` entry updated and `PLAYER_AIM_CHANGED` is emitted
  - after a tick where the target enemy dies, `targetId` becomes `null` and
    `PLAYER_AIM_CHANGED` is emitted
  - a player in manual mode is not re-targeted during a tick (P3: no spurious emit)
  - a downed player is skipped (P5)
  - if target does not change, `PLAYER_AIM_CHANGED` is not emitted (P3)

- [x] T7 [R1] — Create `src/client/public/manifest.json` and update
  `src/client/index.html` with the manifest link and iOS meta tags.
  Test: `src/client/src/manifest.test.ts`
  - manifest.json has fields: `name`, `short_name`, `display: "standalone"`,
    `start_url`, `theme_color`, `background_color`, `icons` (array of ≥ 1)
  - `index.html` contains `<link rel="manifest">`
  - `index.html` contains `apple-mobile-web-app-capable` meta tag
  - `index.html` contains `apple-mobile-web-app-status-bar-style` meta tag

- [x] T8 [R2] — Create `src/client/vite.config.ts`, update `src/client/index.html`
  with a React root mount point, and create `src/client/src/App.tsx` that calls
  `useSocket()`.
  Test: `src/client/src/App.test.tsx`
  - `App.tsx` compiles under strict mode with no import errors
  - `useSocket.ts` exports a function that returns a socket.io `Socket` instance
  - the socket URL is derived from `import.meta.env.VITE_SERVER_URL` with
    `http://localhost:3000` as the fallback
  - the socket instance is created once on mount via useEffect

- [x] T9 [R3] — Implement `VirtualJoystick.tsx` in `src/client/src/components/`.
  Test: `src/client/src/components/VirtualJoystick.test.tsx`
  - renders and mounts without crashing
  - left-side touch move emits normalized direction vector via onMove
  - right-side touch move emits normalized direction vector via onAim
  - touch end emits (0, 0) to signal stop
  - right-side touch does not trigger onMove (correct side routing)

- [x] T10 [R9] — Add the mouse-aim listener in `src/client/src/App.tsx` for
  desktop devices.
  Test: `src/client/src/App.test.tsx` (extended)
  - a `mousemove` event emits `aim-player` with direction vector relative to viewport centre
  - no `mousemove` for 500 ms → the timeout fires `aim-player { dx: 0, dy: 0 }`
