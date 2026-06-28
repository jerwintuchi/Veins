# Cosmology

> **Status:** Drafted (canon framework; proper nouns open).
> **See also:** [../lore.md](../lore.md) · [bestiary-fiction.md](bestiary-fiction.md) · [../vision.md](../vision.md)

## Purpose

The shape of reality in Testament: the divine, the decay, and where Manifestations
come from. This is the bedrock the rest of the fiction stands on.

## Design Philosophy

### The God

There is **one true, reigning, holy God**. This is established fact in the world,
not a faith claim the player is invited to doubt. God is not dead, not exiled, not
asleep, and not a metaphor. God operates according to His own nature.

What humans cannot agree on is whether God is **silent**. To some scholars the
absence of obvious intervention is abandonment; to others it is patience, judgment
held in reserve, or a test. The text takes no side: God's apparent silence is a
human reading, never a narrated truth. Very rarely, a **miracle-moment** breaks
through (seeded as a future system, not specified here), which keeps the question
permanently unsettled rather than resolving it.

The register is Dante and Blasphemous: penance, judgment, a harsh sacred order, but
under a God who genuinely *is*, not a void dressed in church clothes.

### The sacred decay

Reality is breaking down along its sacred seams. The bond between the world and the
divine order is fraying, and where it frays, meaning, matter, and belief leak into
one another. This is the **sacred decay**: the slow, ongoing condition of the age.
It is the reason the world is dark, the reason relics break, and the reason the
Collegium's work has become desperate rather than scholarly leisure.

The decay is a condition, not a villain. There is no single enemy behind it to
defeat. This matters: the game is about *enduring and understanding* a decaying
sacred order, not slaying the thing that caused it.

### Where Manifestations come from

In the gaps the decay opens, **Manifestations** arise: phenomena born of **belief,
sin, or broken relics**. A congregation's terror, a hidden sin given too much
weight, a reliquary cracked open and bleeding its sanctity: any of these can
congeal into something that walks. When the Collegium has observed and classified a
Manifestation enough to confirm it, it is named an **Incarnate**: something made
flesh.

Crucially, **no one knows for certain what an Incarnate is**. Is it God's judgment
made material? A demonic corruption? Mere congealed belief, a "plague of meaning"
with no author? Each is a serious position held by serious scholars. The world
offers only observable facts; interpretation is left to the reader. (See the
competing schools in [bestiary-fiction.md](bestiary-fiction.md).)

## Non-negotiable Rules

1. God is real, holy, and reigning. Never narrate the divine as dead or defeated.
2. The sacred decay has no single slayable author. Do not write a "cause boss" whose
   death fixes reality.
3. The true nature of Incarnates is never resolved in the text. Keep it interpretable.
4. Miracles are rare and never on-demand; they deepen the mystery, never explain it.

## Implementation Notes

- The decay is the fictional parent of the **Condition** axis (weather, time, sacred
  decay level) in [../gameplay.md](../gameplay.md): a site's decay state is both flavor and mechanics.
- "Born of belief, sin, or broken relics" gives three fictional families that the
  data-driven [incarnate catalog](../content/incarnate-catalog.md) can draw from.
- The unresolved-nature rule is enforced in code by invariant 3 (trait roll never
  leaves the server). The player is structurally kept in the scholar's position.

## Future Expansion

- A loose timeline: when the decay began, and the events that first forced the
  Collegium to confront it.
- The theology of relics: why a broken holy object can bleed a Manifestation.
- The miracle-moment system as its own design once core systems exist.
