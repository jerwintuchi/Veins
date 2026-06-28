# Incarnates

> **Status:** Drafted. **Origin** and the genus-not-script rule are canon (DECISION_LOG TD-015);
> the six trait axes below are the v1 working set, open to refinement in playtest.
> **Spine:** Observe → Hypothesize → Test → Record  ·  **Index:** [../README.md](../README.md)
> **See also:** [sign-language.md](sign-language.md) · [contracts.md](contracts.md) · [../lore/bestiary-fiction.md](../lore/bestiary-fiction.md)

## Purpose

The data model of an Incarnate: the hidden roll the server holds, how it becomes the
*signs* a party reads, and how a correct reading pays off. This is the soul of the game
expressed as a schema.

## Design Philosophy

### The model

```
Incarnate = {
  origin:    Belief | Sin | Relic   (the genus; may be a hybrid at high tiers)
  traits:    { axis -> value }       (a subset, sized by contract tier)
  mutation?: a sign-masking / trait-altering modifier (higher tiers)
}
```

Everything in here is **server-only**. The client never receives a trait or an Origin;
it receives the *signs* derived from them (CLAUDE.md invariant 3, netcode I5).

### Origin: the genus (TD-015)

**Origin** is the Incarnate's genus and maps the lore one-to-one: **Belief** (corrupted
mind/thought), **Sin** (corrupted will/deed), **Relic** (corrupted matter). It is
**asserted by the contract but falsifiable** at higher tiers, and may be a **hybrid**
(e.g. Relic-Sin) in the hardest contracts. Origin maps to the three Choir schools
(Belief→Meaning, Sin→Judgment, Relic→Sanctity).

> **Origin is a property, never a script.** It colors a hunt (sign dialect, applicable
> rites, site affinity, behavioral pull); it never dictates how you must play. The
> expedition's mandate comes from the orthogonal contract axes (Verb, Clause, Objective,
> Site, Condition). "Do not break the relic" is a Clause, not a fact about Relic-born.
> This rule is what keeps Origin a source of variety instead of repetition.

Each Origin carries a signature verb-tension (a design seed, to be tuned): Belief =
observation can feed it (tuning risk, see Future Expansion); Sin = resolvable by penance;
Relic = its relic is heart and prize, but only constrained when a Clause demands it intact.

### The trait axes (v1 working set)

Each axis holds one value from a small enum; each value emits exactly one **sign** in one
**perception channel**. The party reads signs, infers traits, and brings or uses **counters**.

| Axis | What it is | Payoff layer (TD-013) | Sign channel |
|------|-----------|-----------------------|--------------|
| **Aspect** | essential nature (ember, mire, frost, rot, radiance...) | combat: damage affinity | Residue (marks on the site) |
| **Frailty** | its true vulnerability | combat: the right counter *bites* | Stress-mark (mark/behavior when hurt) |
| **Ward** | what it shrugs off | combat: the wrong counter *bounces* | Reaction (response to a probe) |
| **Disposition** | behavior (ambusher, stalker, territorial, frenzied) | tactics + pressure | Spoor (tracks, movement cadence) |
| **Rite-key** | the correct capture/banish method | method: gates the non-kill verbs | Liturgy (symbols, resonance) |
| **Tell** | its signature lethal attack | survival: read it to avoid death | Omen (wind-up cue, pre-attack sign) |

Aspect and Origin are **orthogonal**: a Sin-born can be ember-aspected (wrath) or
frost-aspected (a cold betrayal), so the two compose for depth rather than collapsing.

### Tier scaling (TD-014)

The contract tier (gated by Collegium Rank) sets how many axes are active and whether
mutations are present:

- **Apprentice:** ~3 axes (Aspect, Frailty, Tell), clean signs, reliable Origin.
- **Journeyman:** add Disposition and Ward; perhaps one mutation; Origin still usually reliable.
- **Master:** all six including Rite-key; mutations that **mask or invert signs**; Origin
  may be falsified or hybrid. A forensic diagnosis.

## Non-negotiable Rules

1. **Origin is a property, not a script** (TD-015). The expedition mandate comes from the contract axes.
2. The trait roll and Origin **never cross the wire**; only derived signs do (invariant 3, I5).
3. **No canonical "true nature" reveal** (TD-010): the fiction never settles what an Incarnate ultimately *is*.
4. **Every axis has a concrete payoff hook** (TD-013). An axis with no effect on combat, method, or survival does not belong.
5. The number of exposed axes is **variable by tier** (TD-014); the schema must support partial rolls.
6. The **Choir edge is informational and fair** (TD-015): never raw power, never a gap that punishes solo or off-Choir parties.

## Implementation Notes

- Server-only. An Incarnate's roll is generated from the expedition seed (I3), deterministically.
- **Sign derivation** is a pure server function `traits -> signs[]` (detailed in [sign-language.md](sign-language.md)); only `signs` are broadcast as deltas.
- **Distributed perception:** the six sign channels (Residue, Stress-mark, Reaction, Spoor, Liturgy, Omen) are split across the party; each member perceives a subset, so the table is filled by talking. Solo perceives all but is stretched (cannot watch every channel at once; probing is slower).
- **Payoff hooks** key off axes: Aspect/Frailty -> which tool/rite bites in combat; Rite-key -> which ritual enables capture/banish; Tell -> the readable lethal window; Disposition -> route and pressure tactics.
- This is **new code**, not reused prototype logic. The kept tick/projectile tech serves the *tool* layer of combat ([combat.md](combat.md)), not the trait model.

## Future Expansion

- **Mutations** as their own content axis ([../content/mutations.md](../content/mutations.md)): masking, inverting, or adding signs.
- **Hybrid Origins** at master tier, balanced to stay rewarding (TD-015).
- **Prototype the Belief-born observation cost** carefully before committing: it must not make probing a trap that kills the diagnosis loop for that whole Origin. Likely channel-specific or a slow build with a clear payoff for the risk.
- The data-driven [incarnate catalog](../content/incarnate-catalog.md) composes Origin x axis-values x mutation into hundreds of entries.
