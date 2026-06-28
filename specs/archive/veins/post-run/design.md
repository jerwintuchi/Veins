# Design — Post-Run Screen

## New screen state in `App`

```typescript
type Screen = 'lobby' | 'waiting' | 'game' | 'post-run';

type RunEndData = { outcome: 'wiped' | 'extracted'; finalFloor: number };
```

`App` adds:
```typescript
const [runEndData, setRunEndData] = useState<RunEndData | null>(null);
```

## `RUN_ENDED` handler in `App`

```typescript
function onRunEnded(ev: { outcome: string; finalFloor: number }) {
  setRunEndData({ outcome: ev.outcome as 'wiped' | 'extracted', finalFloor: ev.finalFloor });
  setScreen('post-run');
}
socket.on('RUN_ENDED', onRunEnded);
```

Phaser cleanup is automatic: the existing `useEffect` returns a destroy callback
when `screen !== 'game'`. Transitioning away from 'game' unmounts the canvas and
all game overlays via React's conditional rendering.

## `PostRunScreen` component

`src/client/src/components/PostRunScreen.tsx` (new file)

```typescript
type Props = {
  outcome: 'wiped' | 'extracted';
  finalFloor: number;
  onReturnToLobby: () => void;
};

export function PostRunScreen({ outcome, finalFloor, onReturnToLobby }: Props) {
  return (
    <div data-testid="post-run-screen" style={{ ... }}>
      <div data-testid="run-outcome">{outcome === 'wiped' ? 'WIPED' : 'EXTRACTED'}</div>
      <div data-testid="run-floor">Floor {finalFloor}</div>
      <button data-testid="return-to-lobby-btn" onClick={onReturnToLobby}>
        Return to Lobby
      </button>
    </div>
  );
}
```

## App render change

```tsx
{screen === 'post-run' && runEndData && (
  <PostRunScreen
    outcome={runEndData.outcome}
    finalFloor={runEndData.finalFloor}
    onReturnToLobby={() => { setScreen('lobby'); setRunEndData(null); }}
  />
)}
```

## Correctness Properties

**P1**: No client-side outcome computation — outcome and floor come exclusively
from the server's `RUN_ENDED` payload.

**P2**: Returning to lobby clears `runEndData` to avoid stale data leaking into
a subsequent run.

## Satisfies Requirements

R1, R2, R3
