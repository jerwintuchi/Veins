# Requirements — Mobile Controls + Auto-Aim

Mobile controls establish the input layer that drives gameplay on touch devices.
The spec has two halves: (a) the client shell + PWA setup that makes the game
installable and playable in standalone mode, and (b) the server-side auto-aim
system that selects attack targets on behalf of players who are not actively
overriding aim. Auto-aim fires in the weapon/attack spec; this spec wires the
target selection logic and the aim-state tracking that spec will consume.

Out of scope: player attacks and projectiles (weapon spec), Phaser game scene
setup and sprite rendering, virtual joystick for aiming (R-stick — deferred to
weapon spec when there is something to aim at), multiplayer lobby UI in React.

---

**R1**: As a mobile player, I can install the game as a PWA so it opens fullscreen
without browser chrome (URL bar, navigation buttons), creating a native-app feel.
- AC: `src/client/public/manifest.json` exists with fields `name`, `short_name`,
  `display: "standalone"`, `start_url`, `theme_color`, and `background_color`
- AC: `src/client/index.html` links to `manifest.json` via `<link rel="manifest">` and
  carries the iOS PWA meta tags: `apple-mobile-web-app-capable`,
  `apple-mobile-web-app-status-bar-style`, and `apple-mobile-web-app-title`
- AC: a Vite config exists at `src/client/vite.config.ts` that serves the client

**R2**: As a developer, the client has a working entry point with a socket.io
connection so the joystick events reach the server.
- AC: `src/client/index.html` mounts the React app root
- AC: `src/client/src/App.tsx` exports a React component that creates a socket.io-client
  connection to the server using `VITE_SERVER_URL` env var (falling back to
  `http://localhost:3001`)
- AC: the socket instance is created once (not per render) and exposed via a
  `useSocket` hook so any child component can emit events

**R3**: As a mobile player, I can move my character by dragging a virtual joystick
in the bottom-left of the screen.
- AC: `src/client/src/components/VirtualJoystick.tsx` renders only on touch devices
  (detected via `window.matchMedia('(hover: none)') ` at mount time)
- AC: while dragging, the component emits `move-player` via the socket at most once
  per animation frame (requestAnimationFrame throttle)
- AC: the emitted `{ dx, dy }` is the normalized direction from joystick center to
  current touch position (magnitude 1 when dragged to or beyond full radius)
- AC: releasing the joystick emits `move-player` with `{ dx: 0, dy: 0 }` exactly once
- AC: the joystick is not rendered on non-touch devices

**R4**: As a game system, the server tracks an aim state per player — either
auto-aim (targeting the nearest enemy) or manual override (a specific direction).
- AC: `AimState` is defined in `src/shared/src/combat.ts` as a discriminated union:
  `{ mode: 'auto'; targetId: string | null } | { mode: 'manual'; dx: number; dy: number }`
- AC: `AimState` is exported from `src/shared/src/index.ts`
- AC: `Room` carries `aimStates: Map<PlayerId, AimState>` (added to `src/server/src/room/state.ts`)
- AC: all players start a run with `mode: 'auto'` and `targetId: null`

**R5**: As a game system, `selectAutoAimTarget` is a pure server function that returns
the nearest alive enemy within `AUTO_AIM_RANGE` units of the player, or `null` if
none qualify.
- AC: `selectAutoAimTarget(playerPos: { x: number; y: number }, enemies: Map<EnemyId, EnemyState>): string | null`
  lives in `src/server/src/combat/autoAim.ts`
- AC: it returns the `id` of the alive enemy with the smallest Euclidean distance from
  `playerPos` that is `<= AUTO_AIM_RANGE`; returns `null` if no alive enemy qualifies
- AC: `AUTO_AIM_RANGE` is a constant in the same file (default 250 units, wider than
  Spitter detection range so the player can auto-target before the enemy moves)
- AC: called twice with identical inputs it returns the same value (deterministic,
  no randomness)
- AC: it does not mutate its inputs

**R6**: As a mobile player, I can send an `aim-player` intention to switch between
auto-aim and manual override so the server knows which mode I am in.
- AC: `aim-player` handler validates payload has `{ dx: number, dy: number }` before
  acting; malformed payloads emit targeted `LOBBY_ERROR` (code `INVALID_REQUEST`)
  and mutate nothing
- AC: a zero vector `{ dx: 0, dy: 0 }` sets the player's aim state to
  `{ mode: 'auto', targetId: null }` (target will be refreshed on the next tick)
- AC: a non-zero vector sets the state to `{ mode: 'manual', dx, dy }` (normalized
  on the server before storing)
- AC: the handler rejects a socket that is not in a room

**R7**: As a game system, aim state changes are broadcast as `PLAYER_AIM_CHANGED`
delta events so clients can render the auto-aim indicator without a full resync (I6).
- AC: `PlayerAimChangedEvent = { playerId: PlayerId; mode: 'auto' | 'manual'; targetId?: string | null; dx?: number; dy?: number }` in `src/shared/src/events.ts`
- AC: `PLAYER_AIM_CHANGED` is emitted to the room whenever a player's aim state
  changes (via `aim-player` handler or the combat tick auto-aim refresh)
- AC: the event is a delta — it does not include the full room state

**R8**: As a game system, the combat tick refreshes auto-aim targets for every player
in `auto` mode, emitting `PLAYER_AIM_CHANGED` when the target changes (enemy moved
into/out of range, or nearest enemy shifted).
- AC: `runCombatTick` calls `selectAutoAimTarget` for each player whose `aimStates`
  entry has `mode === 'auto'` each tick
- AC: if the returned target differs from `room.aimStates.get(playerId).targetId`,
  the state is updated and `PLAYER_AIM_CHANGED` is emitted for that player
- AC: players in `manual` mode are not re-targeted during the tick

**R9**: As a desktop player, mouse position drives the aim direction so the auto-aim
/ manual-override distinction is transparent across device types.
- AC: on desktop (non-touch), `App.tsx` attaches a `mousemove` listener to the canvas;
  on each frame it emits `aim-player` with the direction vector from the player's
  world position to the mouse world position (normalized), effectively keeping the
  server in `manual` mode during mouse use
- AC: when the mouse stops moving (no `mousemove` for 500 ms), the client emits
  `aim-player { dx: 0, dy: 0 }` to revert to auto-aim
