# Veins — Vision & Target Experience

> **Status:** Mixed (canon design pillars + draft emotional-identity notes)
> **Sources:** DESIGN.md ("Why This Works", "Target Experience", "Session Structure"); LORE_DESIGN.md §16; SYSTEM DESIGN DOC.md §8; GPT_CHAT_HISTORY.txt (draft, "what should Veins FEEL like")
> **See also:** [pitch.md](pitch.md) · [README.md](README.md) (the design spine) · [art-bible.md](art-bible.md) · [doctrines.md](doctrines.md)

## Purpose

This file is the **constitution**. It defines what Veins *is for* and the test every feature must pass. When two designs are both buildable, this document — not balance, not novelty — decides which one is Veins. It exists so that humans and Claude Code resolve disagreements the same way.

## The design spine

> **Lore = Mechanics. Mechanics = Theology. Theology = Player Behavior.**

This is not a slogan; it is an implementation constraint with four links, read as a loop:

1. **Lore = Mechanics.** Every fiction has a mechanical body and every mechanic has a fictional meaning. *The party is one organism* is not flavor laid over a co-op shooter — it **is** the shared board, the cross-player synergy rule, and the relic-sacrifice revive. If you can state a piece of lore that no rule expresses, you have a hole; if you can state a rule with no fiction, you have noise.
2. **Mechanics = Theology.** Mechanics encode belief. A relic is *an argument about how reality works*; the board is the *grammar* for assembling those arguments into a coherent (or incoherent) worldview. See [doctrines.md](doctrines.md).
3. **Theology = Player Behavior.** The game infers belief from action. It never shows a doctrine meter or asks for an alignment. It watches how the party builds and fights under the Bleed Clock and infers a doctrine. See [systems/doctrine-tracking.md](systems/doctrine-tracking.md).
4. **(loop) Player Behavior → Lore.** The world then *interprets* that behavior back into fiction — bosses adapt, the world reacts with delay — closing the loop so that what players do becomes what the world is. See [cosmology.md](cosmology.md).

## Concepts — why it works

- **Forced communication.** Synergies fire only across players, so they must be discovered and coordinated out loud, not soloed in a menu.
- **Emergent asymmetric roles.** Roles arise from the board mid-run, not from a class pick. The same player is a different "role" in a different party build.
- **Every run is a new build problem.** The combinatorial, cross-player build space makes replayability structural, not bolted on.
- **Extraction tension.** The Bleed Clock makes every floor a group negotiation ("extract or push?"), never a solo decision.

## Player Experience

The session arc: *strangers → a single organism → survival by mutual sacrifice.* Minute to minute, players are reading each other's slots, calling out adjacencies, and arguing about whether to descend. The intended emotional register is **dependency and melancholy**, not power fantasy. Players should leave saying "the four of us became this weird organism and survived by sacrificing parts of ourselves," not "I got good loot."

### Session structure (experience framing)
1. Lobby → room code join (2–4 players; solo supported, see [systems/solo-play.md](systems/solo-play.md))
2. Run starts: dungeon generated server-side from run ID seed
3. Floors: fight → loot → place relics → descend or extract
4. Bleed Clock ticks; depth multiplies drain rate
5. Extract or die → post-run meta-progression update
6. Meta-progression: unlocks, relic roster expansion, cosmetics

The mechanical loop is specified in [prototype-v1.md](prototype-v1.md).

### Target experience
Sessions: 20–40 min. Meta: months. Browser-only. Free at $0 cost until hundreds of concurrent players.

### The core psychological hook
Players do not choose classes. They reveal beliefs under pressure.

> Build = Doctrine · Doctrine = Behavior under stress · Behavior = World interpretation

## Design alignment — the non-negotiables

(from SYSTEM DESIGN DOC §8; these *are* the favor/avoid guardrails made concrete)

1. **No explicit doctrine UI.** Players never see "Sanctum +12" — only effects. Showing the number would convert interpretation into optimization. See [doctrines.md](doctrines.md), [ui-style-guide.md](ui-style-guide.md).
2. **Delayed consequence.** The world reacts *after* behavior is established, never on the same input. Delay is what manufactures the feeling of being *watched* and *remembered*.
3. **Build = belief consistency, not optimization.** Consistency of doctrine matters more than raw power; the systems reward coherence.
4. **Co-op is structural, not optional.** The game assumes a party; solo relaxes a rule but is never the design center.

Against the **avoid** list: no class selection (roles are emergent), no hardcoded encounters (seeded + tag-driven), no generic RPG meters (doctrine is hidden, loot is build-shaped not number-shaped).

## Implementation Considerations

- The spine is enforceable in code review: a PR that adds a mechanic should be answerable to "what does this *mean*, and what behavior does it read or reward?" If it can't, it's noise.
- "Delayed consequence" is a concrete server rule, not a vibe: doctrine scores accumulate silently and only cross thresholds after sustained behavior (see [systems/doctrine-tracking.md](systems/doctrine-tracking.md)). Avoid one-input → one-effect feedback for doctrine.
- "No doctrine UI" is a payload rule: `BOARD_DOCTRINE_SHIFT` deliberately omits the doctrine name. Keep it that way.

## Future Expansion

- A short **"feature intake" checklist** in this file that every new system must answer (its four links, its favor/avoid posture, its delayed-consequence story) — to keep the spine load-bearing as scope grows.
- An explicit **anti-pattern register** (the generic-RPG temptations already rejected) so future contributors don't re-propose them.

---

## Draft / Exploratory — Emotional identity

> Mined from `GPT_CHAT_HISTORY.txt`. Not yet canon — captures the intended *feel*, to be ratified.

Veins should not feel heroic, bright, or like a Diablo power fantasy. The mechanics are about dependency, sacrifice, shared life, organisms, entropy, pressure, and extraction tension. Everything should say one thing:

> "We are one body trying to survive." — *Four cells inside a dying organism.*

The strongest version of Veins is **biopunk organism horror with melancholy beauty**, where every system — relic adjacency, revives, the Bleed Clock — reinforces one idea: *you are not four heroes, you are one body.*
