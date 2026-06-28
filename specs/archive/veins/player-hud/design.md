# Design — Player HP HUD + lootPool fix

## R1: lootPool fix in App

`RunData` gains a `lootPool` field:
```typescript
type RunData = {
  board: RelicBoard;
  synergyMap: SynergyMap;
  relicRegistry: Record<string, Relic>;
  lootPool: string[];
};
```

`BoardPanel` receives:
```tsx
initialLootPool={runData?.lootPool}
```

`onRunStarted` already calls `setRunData(ev)`, and the server already sends `lootPool`
in the `RUN_STARTED` payload — the only fix is adding the field to the type and the prop.

## R2–R3: Player HP in HUD

`HUD` needs:
- The local player's ID (passed as a prop from App)
- A socket ref (passed as a prop from App)
- State: `{ hp: number; maxHp: number }`

`SceneStore` is NOT the right channel for this — it is Phaser-scene → React, not socket → React.
The HUD must subscribe to socket events directly.

### HUD props change

```typescript
type HUDProps = {
  socketRef: RefObject<Socket | null>;
  localPlayerId: string;
};
```

### HUD state addition

```typescript
const [playerHp, setPlayerHp] = useState({ hp: PLAYER_MAX_HP, maxHp: PLAYER_MAX_HP });
```

### Socket subscriptions added to HUD's useEffect

```typescript
socket.on('RUN_STARTED', () => {
  setPlayerHp({ hp: PLAYER_MAX_HP, maxHp: PLAYER_MAX_HP });
});
socket.on('PLAYER_DAMAGED', (ev: { playerId: string; hp: number }) => {
  if (ev.playerId !== localPlayerId) return;
  setPlayerHp(prev => ({ ...prev, hp: ev.hp }));
});
socket.on('PLAYER_DOWNED', (ev: { playerId: string }) => {
  if (ev.playerId !== localPlayerId) return;
  setPlayerHp(prev => ({ ...prev, hp: 0 }));
});
```

### HUD render addition

```tsx
<div data-testid="player-hp" style={{ color: '#fff', fontSize: '12px', fontFamily: 'monospace' }}>
  HP {playerHp.hp} / {playerHp.maxHp}
</div>
```

## App changes

Pass `socketRef` and `localPlayerId` to `HUD`:
```tsx
<HUD socketRef={socketRef} localPlayerId={localPlayerId} />
```

## Correctness Properties

**P1**: HP value always comes from server — no arithmetic in the client.
**P2**: PLAYER_DAMAGED for a different player is silently ignored.
**P3**: lootPool passes through unchanged from server payload to BoardPanel.

## Satisfies Requirements

R1, R2, R3
