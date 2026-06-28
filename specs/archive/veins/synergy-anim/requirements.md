# Requirements — Synergy Animation

Synergized relic slots should visually pulse so players can immediately see
which relics are firing their bonus effects. The animation must not degrade
performance and must be purely additive to the existing BoardPanel.

Out of scope: different animations per relic tag, entrance/exit transitions,
mobile vibration feedback, sound effects.

---

**R1**: A CSS keyframe animation `synergy-pulse` is injected into the
document on `BoardPanel` mount.
- AC: A `<style>` element containing `@keyframes synergy-pulse` is appended
  to `document.head` when `BoardPanel` mounts
- AC: The style element is removed on unmount (cleanup)
- AC: The animation pulses the SVG drop-shadow filter between dim and bright
  yellow: `drop-shadow(0 0 4px #ffff00)` → `drop-shadow(0 0 14px #ffff00)`
  over 1.5 s, looping infinitely with `ease-in-out`

**R2**: Each synergized slot's `<g>` element has `className="synergized"` and
`data-synergized="true"`.
- AC: When `synergyMap[slot.relicId] === true`, the slot's `<g>` has both
  the class and the data attribute
- AC: When the relic is not synergized (or the slot is empty), neither the
  class nor the attribute is present
- AC: Toggling synergy on a live board re-renders with the correct state

**R3**: Non-synergized slots are unaffected.
- AC: Slots without a relic have no synergy class or attribute
- AC: Slots with a placed relic that is NOT synergized have no synergy class
