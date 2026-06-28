# Design — Lobby UI

## Screen State Machine

```
'lobby' ──(ROOM_UPDATE)──► 'waiting' ──(RUN_STARTED)──► 'game'
```

App.tsx holds `screen: 'lobby' | 'waiting' | 'game'` in state. Each screen
maps to exactly one top-level UI.

## Component Architecture

```
App
├── screen='lobby'   → <LobbyScreen socketRef />
├── screen='waiting' → <WaitingRoom socketRef room localPlayerId />
└── screen='game'
    ├── <div id="game-container">  (Phaser canvas, mounted here)
    ├── <HUD />
    ├── <BoardPanel socketRef localPlayerId phase players initialBoard ... />
    └── <VirtualJoystick />
```

## App state

```typescript
type Screen = 'lobby' | 'waiting' | 'game';

const [screen, setScreen]           = useState<Screen>('lobby');
const [roomSummary, setRoomSummary] = useState<RoomSummary | null>(null);
const [runData, setRunData]         = useState<RunStartedPayload | null>(null);
const [phase, setPhase]             = useState<GamePhase>('loot');
const [localPlayerId, setLocalPlayerId] = useState<string>('');

// Derived — no extra state needed:
const players = roomSummary?.players ?? [];
```

## Socket events handled in App

| Event | Action |
|---|---|
| `connect` | `setLocalPlayerId(socket.id)` |
| `ROOM_UPDATE` | `setRoomSummary(ev.room); setScreen('waiting')` |
| `RUN_STARTED` | `setRunData(ev); setScreen('game')` |
| `PHASE_CHANGED` | `setPhase(ev.phase)` |

## Phaser lazy mount

```typescript
useEffect(() => {
  if (screen !== 'game') return; // skip until game screen is active
  const game = new Phaser.Game({ ... });
  game.registry.set('socketRef', socketRef);
  return () => game.destroy(true);
}, [screen]); // re-runs only on screen change
```

## RunStartedPayload and the board race fix

`RUN_STARTED` fires once. By the time `BoardPanel` mounts (React renders
after `setScreen('game')`), the socket event has already been consumed.
Fix: App captures the payload; BoardPanel accepts it as initial state.

```typescript
// App captures:
function onRunStarted(ev: { board: RelicBoard; synergyMap: SynergyMap; relicRegistry: Record<string, Relic> }) {
  setRunData(ev);
  setScreen('game');
}

// BoardPanel receives and uses as initial state:
const [state, setState] = useState<BoardState>({
  board: initialBoard ?? { slots: {} },
  synergyMap: initialSynergyMap ?? {},
  registry: initialRegistry ?? {},
});
```

BoardPanel's `RUN_STARTED` socket listener is kept as a secondary path (e.g.
in tests where the component is rendered in isolation), but production flow
uses initial props.

## LobbyScreen

```tsx
<div data-testid="lobby-screen" style={{ /* centered full-screen card */ }}>
  <h1 style={{ fontSize: '3rem', color: '#cc2222' }}>Veins</h1>
  <button data-testid="create-room-btn" onClick={createRoom}>Create Room</button>
  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
    <input
      data-testid="code-input"
      value={code}
      onChange={e => setCode(e.target.value.toUpperCase())}
      placeholder="ROOM CODE"
      maxLength={6}
    />
    <button data-testid="join-room-btn" onClick={joinRoom}>Join Room</button>
  </div>
  {error && <p data-testid="lobby-error" role="alert" style={{ color: '#ff4444' }}>{error}</p>}
</div>
```

## WaitingRoom

```tsx
<div data-testid="waiting-room" style={{ /* centered full-screen card */ }}>
  <h2>Room: <span data-testid="room-code">{current.code}</span></h2>
  <ul data-testid="player-list">
    {current.players.map(p => (
      <li key={p}>
        {p === localPlayerId ? 'You' : p}
        {p === current.hostId ? ' ★' : ''}
      </li>
    ))}
  </ul>
  <p style={{ color: '#888' }}>{current.players.length}/4 players</p>
  {isHost && (
    <button data-testid="start-run-btn" onClick={startRun}
            disabled={current.players.length < 2}>
      Start Run
    </button>
  )}
  <button data-testid="leave-btn" onClick={leaveRoom}>Leave Room</button>
</div>
```

## Correctness Properties

**P1 (No board race)**: `RUN_STARTED` payload is captured in App state and
passed as initial props to `BoardPanel` before it mounts. The socket event
is never replayed; initial props are the only reliable source.

**P2 (Payload shape)**: `ROOM_UPDATE` is typed as `{ room: RoomSummary }`.
App reads `ev.room.players`, not `ev.players`.

**P3 (Lazy Phaser)**: `Phaser.Game` is constructed only when the game screen
is active. No WebGL context is created during lobby or waiting phases.

---

## Satisfies Requirements

R1, R2, R3, R4, R5
