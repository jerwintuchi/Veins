# Testament — Gameplay

> **Status:** Canon (loop structure); some tuning values are marked open
> **See also:** [vision.md](vision.md) · [GLOSSARY.md](GLOSSARY.md) · [DECISION_LOG.md](DECISION_LOG.md)

## Purpose

This file defines the expedition loop end to end: what the party does, in what
order, and why each step is fun. It is the bridge between the spine in
[vision.md](vision.md) and the systems that implement it.

## Design Philosophy

The loop is the scientific method with a body count. Each stage maps to a spine verb:

```
PRE-EXPEDITION  (at the Collegium)
  Contract       intel about the target (partial, sometimes WRONG)        [Observe]
  Theory         the party agrees a hypothesis from contract + Archive    [Hypothesize]
  Plan           routes on a fully revealed map (no fog of war)           [Hypothesize]
  Loadout        a shared kit; the bag economy makes it a BET             [Hypothesize]
        |
IN THE FIELD  (the expedition)
  Deploy
  Explore        read the live state of a known map                       [Observe]
  Investigate    confirm or refute the theory via signs and probes        [Test]
  Incarnate Hunt commit to your reading; pay if it was wrong              [Test]
  Extraction     leave with what you learned (and what you carry)         [Test]
        |
POST-EXPEDITION
  Archive update the verdict, party/session scoped                        [Record]
```

## The systems, stage by stage

### 1. The Contract (combinatorial, not handcrafted)

A contract is a roll across orthogonal axes that multiply. This is the entire
replayability engine: a handful of values per axis already yields thousands of
distinct contracts before any art asset is reused.

| Axis | Examples |
|------|----------|
| **Target** | which Incarnate, plus its hidden trait roll and mutation stack |
| **Site** | which biome, which sets environmental modifiers and route topology |
| **Condition** | weather, time, sacred-decay level (changes visibility, behavior, which rites work) |
| **Primary verb** | not always *kill*: capture alive, observe-and-survive, banish by rite, drive off |
| **Secondary objective** | escort, rescue, retrieve, interact, defend, and emergent complications |
| **Clause** | Collegium restrictions: bring it back intact, no fire on consecrated ground, the reliquary must not break |

The contract's intel is **partial and sometimes wrong**. Being wrong is the
challenge, not a bug: it is the reason preparation has teeth.

### 2. Preparation and the loadout (bag) economy

Preparation is a *bet on the theory*. The party assembles a shared kit, and the
**bag economy** makes that a real tradeoff: carrying probing and ritual equipment
costs combat capability. So a party either:

- **specializes** (one investigator loaded with probes and rites, fragile in a
  fight, leaning on teammates to keep them alive), or
- **spreads the tools** (everyone carries some probing and ritual gear, so the
  reading survives if a member goes down, at the cost of peak performance at any
  one thing).

This is the mechanism that fuses Pillar 1 (preparation) with Pillar 4 (forced
cooperation): the bag is where prep, roles, and the reading all intersect. Relic
and rite *combinations* live here.

### 3. The reading: sign language and active probing

The Incarnate's traits are hidden. The party reads them two ways:

- **Signs (passive).** Every trait manifests as a consistent, observable sign:
  weeping wax on stone, a particular resonance, a behavior, a mark in the decay.
  The same sign always means the same thing; *which* Incarnate carries it is
  re-rolled per expedition. Learning the vocabulary is genuine skill (Pillar 2);
  it never appears as a label or a percentage (a Non-negotiable in vision.md).
- **Probes (active).** Investigation is a *verb*, not a wait. Players present a
  relic, ring a bell, expose the thing to flame, and read its reaction. Probing
  costs bag space and exposure, tying it back to the loadout economy.

**Distributed perception** is the forced-cooperation engine: different party
members perceive different sign-channels (tracks and spoor, sound and resonance,
corruption and decay). No single player ever sees the whole picture, so the theory
can only be assembled out loud. Solo relaxes this (a lone scholar perceives all
channels but is stretched thin), so solo is complete but never the design center.

### 4. The hunt and the primary verb

Combat is **real-time top-down action**, reskinned from the prototype's tick for
gothic weight. But *kill* is only one primary verb. Capture-alive, observe-and-
survive, banish-by-rite, and drive-off are equally valid and more on-theme: you
are scholars, and you cannot capture or banish what you have not understood. The
hunt is where the party commits to its reading and pays for being wrong (the wrong
counters, the wrong rites), recoverably, not fatally on the first mistake.

### 5. Pressure (no doom clock)

Field pressure is **diegetic and reactive**, never a timer. The Incarnate's
awareness rises with the party's noise and aggression; the site decays; weather
turns; an escape route can close. Move carefully and quietly and you may take your
time; be loud, greedy, or sloppy and pressure escalates. This preserves the
extraction-tension *feeling* while rewarding deliberation, which is the skill the
game is about.

### 6. Extraction, failure, and the Archive

- **Extraction** is leaving the site with what you learned and what you carry.
- **Commitment** is staked at acceptance (the **Surety**). Backing out is allowed
  but costs the stake and some Collegium standing (to **Recant**). There is no
  death-lock.
- **Failure is a Testament too.** A failed or recanted expedition still writes a
  Field Testament; the partial knowledge enters the session Archive. No expedition
  is ever wasted (Pillar 5). For a co-op game where wipes happen, this is the line
  between "frustrating" and "we know more now."
- **The Archive** is the party's shared, **session-scoped** notebook of confirmed
  Incarnate traits for the current run of expeditions. It is ephemeral: it resets
  with a new session. Only the thin account layer (identity, cosmetics, Collegium
  rank, customization, career stats) persists.

## Non-negotiable Rules

1. Contract intel may be wrong; the game must never guarantee the theory is correct.
2. Every **secondary objective must be a lever on the central hunt**, never a chore
   beside it. It must change how the party reads or fights the Incarnate, or force a
   route/resource tradeoff that interacts with prep. If it does neither, it is filler.
3. The party must feel complete at **1, 2, 3, and 4 players**. Difficulty and the
   perception model scale; the game does not become a different game per party size.
4. Signs and probe reactions are computed server-side. The client renders signs; it
   never receives the underlying trait roll.

## Implementation Notes

- **Reuse from the prototype:** the room/session lifecycle, the 20Hz authoritative
  tick, seeded RNG, procedural layout generation, movement and wall collision,
  projectiles, pathfinding, and separation all carry. The *game rules* layered on
  top (Circulatory Board synergy, Bleed Clock, doctrine scoring, Linked Fates,
  loot pools) are retired and replaced by the systems above.
- **Sign system shape (proposed):** an Incarnate is `{ traits: TraitRoll, signs:
  Sign[] }` where `signs` is derived server-side from `traits` via a fixed mapping;
  only `signs` (as delta events) reach the client. The mapping is the "language."
- Open tuning: Surety cost, Recant penalty, perception-channel count per party
  size, and the bag-slot budget. These are balance values, deferred to a spec.

## Future Expansion

- A **contract-generation spec** (the axis tables and weighting) as the first
  implementation spec after the bible.
- **Non-kill primary verbs** as their own system (capture rig, banishment ritual).
- An **emergent-complication** layer (rival Choirs, collapsing lairs) that injects
  secondary objectives mid-expedition.
- A **probe/relic combination** registry, designed data-first for hundreds of entries.
