# Design — Linked Fates Client UI

## State additions to `BoardPanel`

```typescript
type ReviveState =
  | { active: false }
  | { active: true; downedId: string; step: 'select-source'; error: string | null }
  | { active: true; downedId: string; step: 'select-target'; sourceCoord: HexCoord; error: string | null };

// Added alongside existing useState hooks:
const [revive, setRevive] = useState<ReviveState>({ active: false });
```

## Socket events handled

| Event | New action |
|---|---|
| `RELIC_REMOVED` | Set `slot.relicId = null` for `ev.coord`; re-derive synergy from updated board |
| `PLAYER_DOWNED` | If `ev.playerId !== localPlayerId`, set `revive = { active: true, downedId: ev.playerId, step: 'select-source', error: null }` |
| `PLAYER_REVIVED` | If `ev.playerId === revive.downedId`, set `revive = { active: false }` |
| `LINKED_FATES_ERROR` | Set error in revive state (keep panel open) |

`RELIC_REMOVED` also already arrives after `RELIC_PLACED` in a linked-fates
sequence — the `onRelicPlaced` handler already sets `slot.relicId`; `onRelicRemoved`
clears the sacrificed source.

## `RELIC_REMOVED` handler

```typescript
function onRelicRemoved(ev: { coord: HexCoord; relicId: string; reason: string }) {
  setState(prev => {
    const key = hexCoordKey(ev.coord);
    const slots = { ...prev.board.slots };
    const slot = slots[key];
    if (slot) slots[key] = { ...slot, relicId: null };
    return { ...prev, board: { slots } };
  });
}
```

Note: synergyMap is not directly available here; slots with `relicId: null`
are never rendered as synergized because `synergized = slot.relicId !== null && synergyMap[slot.relicId] === true`.

## Slot click routing

`handleSlotClick` is updated to route based on `revive.step`:

```typescript
// step: 'select-source' — user clicking their own relic slot
if (revive.step === 'select-source') {
  if (slot.ownerId !== localPlayerId) return;
  if (!slot.relicId) return;
  setRevive({ ...revive, step: 'select-target', sourceCoord: slot.coord, error: null });
  return;
}
// step: 'select-target' — user clicking downed player's empty slot
if (revive.step === 'select-target') {
  if (slot.ownerId !== revive.downedId) return;
  if (slot.relicId !== null) return;
  socket.emit('revive', { sourceCoord: revive.sourceCoord, targetCoord: slot.coord });
  setRevive({ active: false }); // optimistic hide
  return;
}
// Normal loot-phase placement (unchanged)
```

## Revive panel render (inside `BoardPanel` return)

Shown when `revive.active`:

```tsx
<div data-testid="revive-panel" style={{ position: 'absolute', top: 8, ... }}>
  {revive.step === 'select-source'
    ? <button data-testid="revive-btn" onClick={...}>Revive teammate — pick a relic to sacrifice</button>
    : <span data-testid="revive-target-hint">Now pick a slot on their board</span>
  }
  {revive.error && <div data-testid="linked-fates-error">{revive.error}</div>}
</div>
```

## Slot visual hints

During source selection: slots where `slot.ownerId === localPlayerId && slot.relicId !== null` get
`data-revive-source="true"`.

During target selection: slots where `slot.ownerId === revive.downedId && slot.relicId === null` get
`data-revive-target="true"`.

## Correctness Properties

**P1**: `reviverId` is never sent by the client — the server derives it from the authenticated socket.
**P2**: Panel appears only for teammate downed events, never for local player downed.
**P3**: Optimistic hide prevents double-revive UI flicker; server's RELIC_REMOVED/RELIC_PLACED
        sequence confirms the mutation.

## Satisfies Requirements

R1, R2, R3, R4, R5
