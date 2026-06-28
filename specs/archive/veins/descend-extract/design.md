# Design — Descend / Extract Buttons

## Component: `DescendPanel`

`src/client/src/components/DescendPanel.tsx` (new)

```typescript
type Props = {
  socketRef: RefObject<Socket | null>;
  phase: GamePhase;
};
```

State:
```typescript
const [pending, setPending] = useState(false);
const [error, setError] = useState<string | null>(null);
```

Socket subscriptions (inside `useEffect`):
```typescript
socket.on('FLOOR_ADVANCED', () => { setPending(false); setError(null); });
socket.on('RUN_ENDED',      () => { setPending(false); setError(null); });
socket.on('LOBBY_ERROR',    (ev) => { setPending(false); setError(ev.message); });
```

Handlers:
```typescript
function handleDescend() { setPending(true); setError(null); socket.emit('descend'); }
function handleExtract()  { setPending(true); setError(null); socket.emit('extract'); }
```

Render (only when `phase === 'loot'`):
```tsx
if (phase !== 'loot') return null;

<div data-testid="descend-panel" style={{ position: 'absolute', bottom: 16, right: 16, ... }}>
  <button data-testid="descend-btn" disabled={pending} onClick={handleDescend}>
    Descend ↓
  </button>
  <button data-testid="extract-btn" disabled={pending} onClick={handleExtract}>
    Extract ↑
  </button>
  {error && <div data-testid="descend-error">{error}</div>}
</div>
```

## App wiring

Inside the `{screen === 'game'}` block, alongside `HUD` and `BoardPanel`:
```tsx
<DescendPanel socketRef={socketRef} phase={phase} />
```

## Correctness Properties

**P1**: No client-side phase logic — `DescendPanel` renders based on the
`phase` prop driven by `PHASE_CHANGED` events from the server.

**P2**: `pending` guard prevents emitting the same action twice before the
server responds. On any terminal event (FLOOR_ADVANCED, RUN_ENDED, LOBBY_ERROR)
pending clears.

## Satisfies Requirements

R1, R2, R3, R4, R5
