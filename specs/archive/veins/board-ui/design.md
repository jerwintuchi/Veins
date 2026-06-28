# Design — Relic Board UI

## Data Models

### Shared additions (`src/shared/src/relics.ts`)

```typescript
import type { Relic } from './board.js';

export const STARTER_RELICS: Relic[] = [
  // --- fire pair ---
  {
    id: 'ember-core',
    name: 'Ember Core',
    tags: ['fire', 'aoe'],
    baseEffect:    { description: 'Attacks deal +5 damage.' },
    synergyEffect: { description: 'Attacks explode on hit, damaging all enemies within 40 units.' },
  },
  {
    id: 'torch-brand',
    name: 'Torch Brand',
    tags: ['fire'],
    baseEffect:    { description: 'Enemies hit are set on fire, taking 3 damage per second for 3s.' },
    synergyEffect: { description: 'Fire status spreads to one adjacent enemy on application.' },
  },
  // --- chain pair ---
  {
    id: 'chain-link',
    name: 'Chain Link',
    tags: ['chain'],
    baseEffect:    { description: 'Every 3rd attack is fired for free (no cooldown cost).' },
    synergyEffect: { description: 'Free attacks chain to a second target within 80 units.' },
  },
  {
    id: 'arc-bolt',
    name: 'Arc Bolt',
    tags: ['chain', 'aoe'],
    baseEffect:    { description: '20% chance each attack chains to one nearby enemy.' },
    synergyEffect: { description: 'Chained attacks pierce through their first target.' },
  },
  // --- shield pair ---
  {
    id: 'iron-skin',
    name: 'Iron Skin',
    tags: ['shield'],
    baseEffect:    { description: 'Reduce all incoming damage by 5 (minimum 1).' },
    synergyEffect: { description: 'Absorb the next attack each floor; resets on floor clear.' },
  },
  {
    id: 'ward-stone',
    name: 'Ward Stone',
    tags: ['shield', 'party'],
    baseEffect:    { description: 'Adjacent allied players take 2 less damage.' },
    synergyEffect: { description: 'On taking a hit, grant all players a 3s shield equal to the damage absorbed.' },
  },
];

export const STARTER_RELIC_IDS = STARTER_RELICS.map(r => r.id);
```

### Server changes (`src/server/src/room/manager.ts`)

In `startRun`, after building the board:

```typescript
import { STARTER_RELICS } from '@veins/shared';
// ...
room.registry = new Map(STARTER_RELICS.map(r => [r.id, r]));
```

### `RUN_STARTED` payload extension (`src/server/src/index.ts`)

```typescript
io.to(code).emit('RUN_STARTED', {
  dungeon: res.dungeon,
  board: res.room.board,
  synergyMap: evaluateSynergies(res.room.board, res.room.registry),
  relicRegistry: Object.fromEntries(res.room.registry), // Map → plain object
});
```

---

## Component Architecture

```
App
├─ <div id="game-container"> (Phaser canvas)
├─ <HUD />         (bleed clock + floor + phase)
├─ <BoardPanel />  (hex grid + relic tray, loot phase only)
└─ <VirtualJoystick />
```

`BoardPanel` is a self-contained React component that manages its own board
state by listening to socket events. It receives `socketRef`, `localPlayerId`,
and `phase` as props. It does NOT go through `sceneStore` — the board is
UI state, not game-world state.

---

## Hex Grid Rendering

### Axial → pixel (flat-top hexagons, size 38px)

```typescript
const HEX_SIZE = 38;
const SQRT3 = Math.sqrt(3);

function hexToPixel(q: number, r: number): { x: number; y: number } {
  return {
    x: HEX_SIZE * (3 / 2 * q),
    y: HEX_SIZE * (SQRT3 / 2 * q + SQRT3 * r),
  };
}
```

### Flat-top polygon corners (center cx, cy)

```typescript
function hexPoints(cx: number, cy: number): string {
  return [0, 60, 120, 180, 240, 300]
    .map(deg => {
      const rad = (Math.PI / 180) * deg;
      return `${cx + HEX_SIZE * Math.cos(rad)},${cy + HEX_SIZE * Math.sin(rad)}`;
    })
    .join(' ');
}
```

### Owner color mapping

```typescript
// Players are ordered as they appear in room.players (server order).
// localPlayerId always maps to index 0 of a "local-first" reordering.
const OWNER_COLORS = ['#4488ff', '#ff8844', '#44cc44', '#cc44ff'];

function ownerColor(ownerId: string, localId: string, players: string[]): string {
  if (ownerId === localId) return OWNER_COLORS[0]!;
  const others = players.filter(p => p !== localId);
  const idx = others.indexOf(ownerId);
  return OWNER_COLORS[idx + 1] ?? '#888888';
}
```

### SVG layout

ViewBox: `-160 -160 320 320` (radius-2 hex at size 38 fits in ±150px).

Each slot renders as:

```tsx
<g key={key} onClick={() => handleSlotClick(slot)}>
  <polygon
    points={hexPoints(px, py)}
    fill={fill}
    stroke={synergized ? '#ffff00' : '#555'}
    strokeWidth={synergized ? 3 : 1}
    opacity={slot.relicId ? 0.9 : 0.5}
  />
  {slot.relicId && (
    <text x={px} y={py} textAnchor="middle" dominantBaseline="middle"
          fill="#fff" fontSize="8" style={{ pointerEvents: 'none' }}>
      {registry[slot.relicId]?.name ?? slot.relicId}
    </text>
  )}
</g>
```

---

## BoardPanel state

```typescript
const [board, setBoard]         = useState<RelicBoard>({ slots: {} });
const [synergyMap, setSynergy]  = useState<SynergyMap>({});
const [registry, setRegistry]   = useState<Record<string, Relic>>({});
const [selected, setSelected]   = useState<string | null>(null); // relicId
```

### Socket events handled

| Event | Action |
|---|---|
| `RUN_STARTED` | `setBoard`, `setSynergy`, `setRegistry` |
| `BOARD_STATE_SYNC` | `setBoard`, `setSynergy`, `setRegistry` |
| `RELIC_PLACED` | update `board.slots[hexCoordKey(coord)].relicId`; `setSynergy(synergyMap)` |

### handleSlotClick

```typescript
function handleSlotClick(slot: RelicSlot): void {
  if (!selected) return;
  if (slot.ownerId !== localPlayerId) return;
  if (slot.relicId !== null) return;
  socket.emit('place-relic', { coord: slot.coord, relicId: selected });
  setSelected(null); // optimistic deselect
}
```

### Unplaced relics (RelicTray)

```typescript
const placedIds = new Set(
  Object.values(board.slots).map(s => s.relicId).filter(Boolean)
);
const available = Object.values(registry).filter(r => !placedIds.has(r.id));
```

---

## Layout and styling

```tsx
// BoardPanel wrapper
<div style={{
  position: 'absolute',
  bottom: '80px',    // above VirtualJoystick
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '8px',
  pointerEvents: 'auto',
  background: 'rgba(0,0,0,0.7)',
  borderRadius: '12px',
  padding: '12px',
}}>
  <svg width="320" height="320" viewBox="-160 -160 320 320">
    {/* hex slots */}
  </svg>
  {/* RelicTray */}
  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
    {available.map(relic => (
      <button key={relic.id} onClick={() => setSelected(s => s === relic.id ? null : relic.id)}
              style={{ border: selected === relic.id ? '2px solid #ffff00' : '2px solid #555', ... }}>
        {relic.name}
      </button>
    ))}
  </div>
</div>
```

---

## Correctness Properties

**P1 (Server authority)**: `place-relic` emits an intention only. The server
validates slot ownership, relic existence in registry, and loot-phase guard.
Clients render only after receiving `RELIC_PLACED`.

**P2 (Optimistic deselect)**: After emitting `place-relic`, the client clears
`selected` immediately, preventing duplicate sends for the same slot.

**P3 (No game logic client-side)**: Synergy evaluation never runs in the client.
The `synergyMap` received from the server is the sole source of synergy truth.

---

## Satisfies Requirements

R1, R2, R3, R4, R5, R6, R7, R8
