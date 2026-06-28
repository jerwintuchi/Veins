# Tasks — Synergy Animation

---

- [x] T1 [R1, R2, R3] — Add CSS pulse animation to `BoardPanel` and
  `data-synergized` attribute to synergized slot `<g>` elements.
  Test: `src/client/src/components/BoardPanel.test.tsx` (extended)
  - a `<style>` element with id `synergy-pulse-style` exists in
    `document.head` after `BoardPanel` mounts
  - a synergized slot's `<g>` has `data-synergized="true"`
  - a slot without a relic does NOT have `data-synergized`
  - a placed-but-not-synergized slot does NOT have `data-synergized`
