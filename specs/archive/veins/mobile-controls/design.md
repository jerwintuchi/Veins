# Design — Mobile Controls + Auto-Aim

## Data Models

### Shared types (`src/shared/src/combat.ts`) — additions

```typescript
// Which enemy the player is currently locked onto (auto-aim), or
// the direction they are explicitly aiming (manual override / desktop mouse).
export type AimState =
  | { mode: 'auto';   targetId: string | null }
  | { mode: 'manual'; dx: number; dy: number  };
```

### Shared events (`src/shared/src/events.ts`) — new

```typescript
export type PlayerAimChangedEvent = {
  playerId: PlayerId;
  mode:     'auto' | 'manual';
  targetId?: string | null;  // present when mode === 'auto'
  dx?:      number;          // present when mode === 'manual'
  dy?:      number;          // present when mode === 'manual'
};
```

### Room additions (`src/server/src/room/state.ts`)

```typescript
// Added to Room:
aimStates: Map<PlayerId, AimState>;
```

All players start in `{ mode: 'auto', targetId: null }`. The combat tick populates
`targetId` from `selectAutoAimTarget`; the `aim-player` handler flips between modes.

---

## Algorithms

### Auto-aim target selection (`src/server/src/combat/autoAim.ts`)

```
AUTO_AIM_RANGE = 250  // units; wider than Spitter detectionRange (300) intentionally
                      // so the UI indicator appears before the enemy starts moving

selectAutoAimTarget(
  playerPos: { x: number; y: number },
  enemies:   Map<EnemyId, EnemyState>,
): string | null

  best     = null
  bestDist = Infinity
  for each (id, enemy) in enemies where enemy.alive:
    dist = euclidean(playerPos, enemy)
    if dist <= AUTO_AIM_RANGE and dist < bestDist:
      best     = id
      bestDist = dist
  return best
```

Pure function. No mutations. Deterministic (tie-break is Map insertion order, which
is stable within a tick). No randomness.

### Auto-aim refresh in combat tick (`src/server/src/index.ts`)

Inside `runCombatTick`, after `stepCombat` updates enemies, for each player in the room:

```
for each (playerId, aimState) in room.aimStates where aimState.mode === 'auto':
  player   = room.playerStates.get(playerId)
  if player is undefined or player.downed: continue
  newTarget = selectAutoAimTarget(player, room.enemies)
  if newTarget !== aimState.targetId:
    room.aimStates.set(playerId, { mode: 'auto', targetId: newTarget })
    io.to(room.code).emit('PLAYER_AIM_CHANGED', {
      playerId, mode: 'auto', targetId: newTarget,
    })
```

This runs every 100ms in combat, keeping the auto-aim indicator tight to enemy
movement.

### aim-player handler (`src/server/src/index.ts`)

```
socket.on('aim-player', (payload)):
  room = currentRoom(); if !room → error
  { dx, dy } = payload; validate numbers → error on fail

  const mag = sqrt(dx*dx + dy*dy)
  let next: AimState
  if mag < 1e-6:                                // effectively zero vector → auto mode
    next = { mode: 'auto', targetId: null }     // target refreshed next tick
  else:
    next = { mode: 'manual', dx: dx/mag, dy: dy/mag }   // normalize

  if JSON.stringify(next) !== JSON.stringify(room.aimStates.get(playerId)):
    room.aimStates.set(playerId, next)
    io.to(room.code).emit('PLAYER_AIM_CHANGED', { playerId, ...next })
```

The normalization ensures manual aim vectors always have unit length regardless of
whether the client sends a unit vector or not.

### VirtualJoystick component (`src/client/src/components/VirtualJoystick.tsx`)

```
State: { active: boolean; originX, originY, currentX, currentY: number }

JOYSTICK_RADIUS = 60 (px)   // thumb travel distance for full deflection

onPointerDown(e):
  setActive(true)
  origin = { x: e.clientX, y: e.clientY }

onPointerMove(e):
  if !active: return
  dx = e.clientX - origin.x
  dy = e.clientY - origin.y
  mag = sqrt(dx² + dy²)
  clamped_dx = (mag > JOYSTICK_RADIUS) ? dx/mag * JOYSTICK_RADIUS : dx
  clamped_dy = ...same...
  setCurrent(origin + clamp)
  // Emit normalized direction (not pixel offset).
  socket.emit('move-player', { dx: dx/max(mag, JOYSTICK_RADIUS), dy: dy/max(mag,JOYSTICK_RADIUS) })
  // Throttled to rAF (one emit per animation frame via useRef flag).

onPointerUp:
  setActive(false)
  socket.emit('move-player', { dx: 0, dy: 0 })
```

Rendered as two CSS-positioned circles (base + thumb) absolutely positioned in the
bottom-left quadrant of the viewport. `touch-action: none` on the outer container
prevents scroll interference. `pointer-events: none` on the thumb so drags don't
stutter when the finger wanders off the thumb.

---

## Client Structure

```
src/client/
  index.html                         ← root HTML, links manifest, iOS meta tags
  vite.config.ts                     ← Vite config for React + static asset serving
  public/
    manifest.json                    ← PWA manifest (display: standalone)
  src/
    App.tsx                          ← socket connection + top-level render
    hooks/
      useSocket.ts                   ← singleton socket instance
    components/
      VirtualJoystick.tsx            ← left-stick movement joystick (touch only)
```

No game canvas scene is introduced here; that belongs to the rendering spec.

---

## Correctness Properties

**P1 (Server authority)**: Auto-aim target selection is server-side only. Clients
send `aim-player { dx: 0, dy: 0 }` to request auto-mode; the server selects the
actual target and broadcasts it. Clients cannot inject a target ID.

**P2 (Deterministic selection)**: `selectAutoAimTarget` is a pure function. Same
enemies and player position always yield the same target. Tie-breaking is Map
insertion order, which equals spawn order (deterministic per R3/spawnEnemies).

**P3 (Delta only)**: `PLAYER_AIM_CHANGED` is emitted only when the aim state
actually changes (target shifted or mode flipped). No per-tick resync (I6).

**P4 (Normalized manual aim)**: The server normalizes the manual aim vector before
storing it, so the weapon spec can use it directly as a unit direction without a
second normalization.

**P5 (No aim during downed)**: A downed player is skipped in the auto-aim refresh
loop. Their aim state is left stale; it will be refreshed once they are revived.

---

## Socket Events

**aim-player** (client to server): `{ dx: number; dy: number }`
Zero vector → auto mode. Non-zero → manual override (server normalizes).
Validated before use (I2).

**PLAYER_AIM_CHANGED** (server to client): `{ playerId; mode; targetId?; dx?; dy? }`
Delta event. Emitted when mode or target changes. All players in the room receive
it so everyone can render the auto-aim indicator over the correct enemy.

---

## PWA Manifest Fields

```json
{
  "name":             "Veins",
  "short_name":       "Veins",
  "description":      "Co-op extraction roguelike — play in your browser.",
  "display":          "standalone",
  "start_url":        "/",
  "theme_color":      "#0d0d0d",
  "background_color": "#0d0d0d",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

Icon placeholder PNGs are 1×1 transparent PNGs at the correct filenames; real art
belongs to the art/branding pass.

---

## Open Threads (not in this spec)

- Virtual joystick for aiming (right stick) — deferred until the weapon spec adds
  attacks; the `aim-player` event is already defined and wired so adding the UI
  is a one-file addition.
- Gamepad / controller support — follow-up after touch controls stabilize.
- Service worker / offline caching — PWA enhancement for the asset-pipeline spec.
- Mouse aim world-to-screen coordinate conversion — requires a Phaser camera
  reference not yet available; the `aim-player` event is ready to receive it.
- Per-player aim indicator rendering (highlight targeted enemy) — client rendering
  spec; server already emits `PLAYER_AIM_CHANGED` with `targetId`.

---

## Satisfies Requirements

R1, R2, R3, R4, R5, R6, R7, R8, R9
