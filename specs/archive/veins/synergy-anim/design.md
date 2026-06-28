# Design — Synergy Animation

## CSS injection

```typescript
// injected once on BoardPanel mount via useEffect
const SYNERGY_STYLE_ID = 'synergy-pulse-style';

const SYNERGY_CSS = `
@keyframes synergy-pulse {
  0%,100% { filter: drop-shadow(0 0 4px #ffff00); }
  50%      { filter: drop-shadow(0 0 14px #ffff00); }
}
.synergized {
  animation: synergy-pulse 1.5s ease-in-out infinite;
}
`;

useEffect(() => {
  const el = document.createElement('style');
  el.id = SYNERGY_STYLE_ID;
  el.textContent = SYNERGY_CSS;
  document.head.appendChild(el);
  return () => { document.getElementById(SYNERGY_STYLE_ID)?.remove(); };
}, []);
```

Using an id avoids duplicate injection if the component remounts quickly.

## Slot `<g>` element

```tsx
const synergized = slot.relicId !== null && synergyMap[slot.relicId] === true;

<g
  key={key}
  className={synergized ? 'synergized' : undefined}
  data-synergized={synergized ? 'true' : undefined}
  onClick={() => handleSlotClick(slot)}
  style={{ cursor: 'pointer' }}
>
```

The `data-synergized` attribute allows test assertions without relying on
CSS class side-effects; the `className` drives the visual animation.

## Test approach

Since happy-dom does not evaluate CSS animations, tests verify:
1. The `<style>` element is present in `document.head` after mount
2. The synergized `<g>` has `data-synergized="true"`
3. Non-synergized `<g>` elements do NOT have `data-synergized`

---

## Satisfies Requirements

R1, R2, R3
