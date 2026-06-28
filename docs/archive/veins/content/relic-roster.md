# Content — Relic Roster

> **Status:** Mixed (canon paper roster + implemented starter set + draft organ-relics)
> **Sources:** SYSTEM DESIGN DOC.md §3 (12 designed relics); DECISION_LOG.md (board-ui STARTER_RELICS, relic-effects); GPT_CHAT_HISTORY.txt (draft, organ-relics)
> **See also:** [systems/relics.md](../systems/relics.md) · [doctrines.md](../doctrines.md) · [content/mutations.md](mutations.md)

## Purpose

This is the **catalogue** — the actual relics, their effects, and their doctrine leanings. It is content layered on the rules in [systems/relics.md](../systems/relics.md). Its design job: every relic must be a *word in the doctrine vocabulary* (an argument about reality), not just a stat stick, and the set as a whole must offer enough cross-player synergy to keep the board a conversation.

## Concepts

### Paper design — the 12 v1 relics (by doctrine)

**Sanctum**
1. **Lumen Seal** — +10% damage if no mutation relic adjacent; adjacency bonus suppresses randomness.
2. **Ivory Node** — non-adjacent relics gain +5% effect.
3. **Static Plate** — prevents negative mutation effects on owner.

**Chorus**
4. **Resonant Coil** — adjacent relic effects shared with nearest ally.
5. **Dual Pulse** — synced ability usage increases damage (stacking buff).
6. **Neural Bridge** — 1 relic effect mirrored to teammate slot.

**Tumor**
7. **Growth Sac** — random effect mutation every 2 rooms.
8. **Fractal Cell** — adjacency effects increase over time.
9. **Hematic Bloom** — kills spawn temporary buff spores.

**Penitent**
10. **Ash Reliquary** — sacrifice relic = permanent +15% scaling.
11. **Quiet Coil** — stationary = damage reduction + scaling.
12. **Burden Chain** — carry "lost relics" for stacking buffs.

### Implemented — STARTER_RELICS (current build)
The shipped prototype hard-codes 10 starter relics in `@veins/shared` (3 tag-pairs for synergy). Combat-resolving effects currently wired (see [systems/combat.md](../systems/combat.md)):
- **ember-core** — bonus damage + splash.
- **torch-brand** — fire DoT.
- **arc-bolt** — chain lightning.
- **iron-skin** — incoming damage reduction.
- **void-lens** — intentionally **doctrine-neutral** (no doctrine tag).

All 10 carry doctrine tags except `void-lens`. Doctrine scoring keys off these tags — see [systems/doctrine-tracking.md](../systems/doctrine-tracking.md).

> The paper 12 and the implemented 10 are not yet reconciled into one canonical list. The **implemented set is the source of truth for current behavior**; the paper set is design intent.

## Player Experience

Reading a relic, the player should feel a *flavor and a leaning*, not just a number. "Ash Reliquary rewards sacrifice" telegraphs Penitent; "Neural Bridge mirrors to a teammate" telegraphs Chorus and *demands* a partner. The roster should make players want to **say something coherent** with their slots — and reward them (via synergy + quiet doctrine alignment) when they do. The best moment is realizing a relic that looks weak alone is the linchpin of a teammate's build.

## Design alignment

The roster is *Mechanics = Theology* at content scale: each relic is loosely doctrine-aligned but mixable (words, not classes). Keeping relics **data-driven** with tags (not bespoke code) honors *emergence over hardcoded content*. The neutral `void-lens` is deliberate connective tissue so the vocabulary isn't four sealed colors. No relic grants a *role* — it grants an *argument*.

## Implementation Considerations

- Relics are data in `@veins/shared`; effects resolve via pure server functions (`evaluateRelicHit` / `evaluateIncomingDamage`). Adding a relic = add data (+ one pure resolver if it's a new effect kind). See [systems/relics.md](../systems/relics.md).
- **Roster reconciliation is an open task**: decide whether the canonical set is the implemented 10, the paper 12, the draft organs, or a merge. Until then, code = truth for behavior. **TODO(decide):** pick the canonical roster (implemented 10 / paper 12 / organs / merge). See [OPEN-QUESTIONS.md](../OPEN-QUESTIONS.md) §B.
- Tag hygiene: every relic's `RelicTag`s drive *both* synergy and doctrine scoring — review tags when adding/editing relics (a mis-tag silently shifts doctrine scoring).

## Future Expansion

- **Reconcile + expand to a single canonical roster**, with each doctrine fully voiced (mutation, sacrifice-conversion, synchronized-cooldown effect kinds).
- **Rarities, upgrades, multi-pick loot** — gated to grow build space over raw power (see [progression.md](../progression.md)).
- **Mutation-reactive relics** (see [mutations.md](mutations.md)) and **pattern-sensitive relics** (chain/cluster/mirror — see [doctrines.md](../doctrines.md)).

---

## Draft / Exploratory — Relics as organs

> Mined from `GPT_CHAT_HISTORY.txt`. Flavor direction: relics are **organs**, not items. Not yet ratified.

- **Left Ventricle** — +15% attack speed; adjacent to **Right Ventricle** → synchronized attacks.
- **Optic Nerve** — crits reveal weak spots; adjacent to another player's **Cerebellum** → shared vision.
- **Spleen** — revives stronger; adjacent to **Bone Marrow** → sacrifice consumes only half effect.
- **Tumor** — huge buffs, random mutations, can spread to adjacent relics; high-risk archetype (see [mutations.md](mutations.md)).
