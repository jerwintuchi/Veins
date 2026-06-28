# Testament — Vision (The Constitution)

> **Status:** Canon
> **See also:** [README.md](README.md) · [gameplay.md](gameplay.md) · [GLOSSARY.md](GLOSSARY.md)

## Purpose

This file decides what Testament *is for*. When two designs are both buildable,
this document, not balance and not novelty, chooses which one is Testament. It
exists so that humans and Claude Code resolve disagreements the same way.

## Design Philosophy

### The spine

> **Observe → Hypothesize → Test → Record.**

Testament is the scientific method played as a cooperative hunt. You are
hunter-*scholars*, so the loop is literally inquiry: you read an unknown thing,
form a theory, bet on it, and write down the verdict. The fiction (scholars of
the Collegium) and the mechanic (diagnose a procedural Incarnate) are the same
object seen from two sides. If you can state a piece of fiction no rule expresses,
you have a hole. If you can state a rule with no fiction, you have noise.

### The five pillars, made concrete

1. **Preparation is as important as combat.** The contract, the theory, the route,
   and the loadout you assemble *before* deploying decide as much as your aim does.
   A wrong theory is survivable but expensive.
2. **Knowledge is progression.** What a veteran carries between expeditions is
   *understanding*, not bigger numbers. Players get better because *they* learn to
   read, not because the game unlocked power for them.
3. **Interpretation, never memorization.** You never look up an Incarnate on a
   wiki. Each one's traits are hidden and re-rolled, so you must *read this one*
   from the signs it leaves, every time. (See "The reading problem" below.)
4. **Cooperation is the primary pillar.** The party perceives the world as a team:
   evidence is distributed, so the theory can only be assembled by talking. Solo is
   supported and must never feel lacking, but the game is designed around a party.
5. **Every expedition becomes another Testament.** Win or lose, an expedition
   produces a Field Testament. Failure still teaches; no run is wasted.

### The reading problem (the soul, and the hardest part)

Pillar 3 forbids memorization but must not collapse into blind guessing. The
resolution is a **legible sign language**: every hidden Incarnate trait manifests
as observable, consistent *signs* in the field (a mark on the stone, a sound, a
behavior, a reaction to a probe). The same sign always means the same thing; which
Incarnate carries it changes every expedition. So players never memorize monsters,
they learn to *read a vocabulary*, and that vocabulary is genuine, transferable
skill (Pillar 2). A hunter-scholar is a doctor: you learn the language of symptoms,
then diagnose each new patient. The full mechanic lives in [gameplay.md](gameplay.md).

## Non-negotiable Rules

1. **No memorizable bosses.** An Incarnate's specific trait roll is hidden and
   re-rolled per expedition. No "phase at 50% HP" patterns that a wiki could teach.
2. **No knowledge as a number.** Never show a "research %" or "weakness: fire"
   label handed to the player. The game shows *signs*; the player draws the
   conclusion. (This is the direct heir of the prototype's "no doctrine meter" rule.)
3. **No doom clock.** Pressure in the field is a *consequence of the party's
   behavior* (noise, aggression, decay, weather), never a metronome that punishes
   careful investigation. Deliberation is the skill we reward.
4. **Preparation must have teeth.** If retrying a contract with no cost were free,
   preparation would stop mattering and players would brute-force by trial. Cost
   lives at commitment (the Surety) and in reactive field consequences.
5. **Cooperation is structural, not bolted on.** Co-op exists because perception is
   distributed, not because the game spawns more enemies for more players. Solo
   relaxes the distribution; it does not unlock a different game.
6. **Systems over content.** Replayability comes from combinatorial axes
   (target × site × condition × objective × clause), not from shipping handcrafted
   encounters. Every new system is designed assuming hundreds of future additions.

## Implementation Notes

- The spine is enforceable in review. A PR that adds a mechanic must answer: which
  of Observe / Hypothesize / Test / Record does this serve, and does it help the
  party *read* an Incarnate? If it cannot, it is noise.
- "Knowledge is progression" is a persistence rule, not a vibe: the *language of
  signs* is never written to the database as an unlock. It lives as player skill
  and as the party's ephemeral in-session Archive. Only identity, cosmetics,
  Collegium rank, customization, and career stats persist. See
  [DECISION_LOG.md](DECISION_LOG.md) TD-006.
- "Interpretation, not memorization" is a netcode rule: the Incarnate's trait roll
  never leaves the server. The wire only ever carries *signs*. See CLAUDE.md
  invariant 3.

## Future Expansion

- A short **feature-intake checklist** every new system must answer (its spine
  verb, its pillar posture, its 500-expedition justification), to keep the spine
  load-bearing as scope grows.
- An **anti-pattern register**: the temptations already rejected (wiki-able bosses,
  weakness labels, doom clocks, content-as-replayability) so they are not re-proposed.
