# Testament — Roadmap

> **Status:** Living document. Phases are gated; each gate must be green before the
> next begins. **Gameplay implementation does not start until Phase 2 completes.**
> **See also:** [README.md](README.md)

## Purpose

The sequenced path from "rebooted repo" to "playable Testament." It exists so that
no one (human or Claude) starts gameplay before the architecture and documentation
are settled, and so every phase has a clear exit gate.

## Principles

- **Documentation and architecture first.** Phases 0–1 commit no gameplay.
- **Every system follows the spec chain:** R# (requirements) → design → T# (tasks) →
  test → implementation. Nothing is "done" without a named passing test.
- **The 500-expedition test gates every system:** if it is not interesting after
  500 expeditions, it is redesigned before it is built.
- **Vertical slices over breadth:** prove one full loop thin before widening content.

## Phases

### Phase 0 — Architecture & Documentation (done)
- **Goal:** a ratified design bible.
- **Delivered:** the bible (`docs/`), the directory hierarchy, the full system specs,
  the lore metaphysics, and the decision log (TD-001..018).
- **Also done:** the repo is renamed to Testament, the prototype client and game rules
  are removed, and the server is a clean lobby + rooms + movement skeleton (TD-019).

### Phase 1 — Godot client & transport spike (no gameplay)
- **Goal:** the skeleton of the real stack stands up and talks.
- **Deliverables:** add the Godot `client/`; reimplement the socket seam over raw
  WebSocket (`ws`) and drop socket.io; one player moving authoritatively in an HTML5 export.
- **Exit gate:** browser round-trip works end to end; `pnpm -r test` green.

### Phase 2 — Protocol contract & shared codegen (no gameplay)
- **Goal:** one language-neutral source of truth for the wire.
- **Deliverables:** the JSON message envelope and event catalog in `src/shared`; the
  `tools/` codegen emitting GDScript constants.
- **Exit gate:** server and client share one protocol.

### Phase 3 — Expedition loop skeleton
- **Goal:** the whole loop runs end to end with placeholder content.
- **Deliverables:** lobby/rooms (kept) → accept a stub contract → deploy → a bare
  field → extract → write a stub Field Testament → session Archive updates.
- **Exit gate:** a party can walk the full Observe→Hypothesize→Test→Record loop with nothing real in it yet.

### Phase 4 — Core systems v1 (the soul)
- **Goal:** a real diagnosis can happen.
- **Deliverables:** contract axes ([systems/contracts.md](systems/contracts.md)), the sign
  language ([systems/sign-language.md](systems/sign-language.md)), probing
  ([systems/investigation-and-probing.md](systems/investigation-and-probing.md)), the loadout/bag
  economy ([systems/loadout-economy.md](systems/loadout-economy.md)), distributed perception.
- **Exit gate:** a party reads an Incarnate from signs and probes and forms a theory.

### Phase 5 — Combat & Incarnate v1
- **Goal:** a full hunt is playable.
- **Deliverables:** the melee + tools combat ([systems/combat.md](systems/combat.md)); one
  Incarnate with a hidden trait roll and signs; one non-trivial primary verb; reactive pressure;
  Surety/Recant; failure-as-Testament.
- **Exit gate:** a complete expedition is winnable and losable, solo and in co-op, and both feel complete.

### Phase 6 — Content scale-up (combinatorial depth)
- **Goal:** prove replayability is structural, not handcrafted.
- **Deliverables:** data-driven catalogs (incarnates, sites/biomes, conditions/weather,
  relics/rites, mutations, objectives/clauses), each authored as data for hundreds of rows.
- **Exit gate:** distinct-feeling expeditions emerge purely from axis combinations.

### Phase 7 — Persistence & account layer
- **Goal:** identity persists; expeditions stay ephemeral.
- **Deliverables:** Supabase thin layer (identity, cosmetics, Collegium rank, customization, career stats).
- **Exit gate:** accounts and cosmetics persist across sessions; no game state is persisted mid-expedition.

### Phase 8 — Polish, balance, deploy
- **Goal:** ship-quality vertical slice.
- **Deliverables:** balance passes, the gothic art and audio pass, HTML5 deploy pipeline (client static host + Fly.io server).
- **Exit gate:** a public, playable slice at $0 hosting cost.

## Sequencing note

Phases 0–2 are architecture and plumbing and commit **no gameplay**, honoring the
documentation-first mandate. Gameplay begins at Phase 3 and always through the spec
chain. The active spec is swapped in `CLAUDE.md` when each new system starts.
