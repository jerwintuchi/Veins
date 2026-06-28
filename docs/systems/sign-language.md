# Sign Language

> **Status:** Drafted. Builds on the trait schema in [incarnates.md](incarnates.md) (TD-015).
> **Spine:** Observe → Hypothesize → Test → Record  ·  **Index:** [../README.md](../README.md)
> **See also:** [distributed-perception.md](distributed-perception.md) · [investigation-and-probing.md](investigation-and-probing.md) · [../lore/bestiary-fiction.md](../lore/bestiary-fiction.md)

## Purpose

How a hidden Incarnate trait becomes an observable **sign** the party can read, while
the underlying trait never leaves the server. This is the mechanism that makes
"interpretation, not memorization" (Pillar 3) a property of the code, not a hope.

## Design Philosophy

### The language is a fixed map, the carrier is not

Every trait axis emits one sign in one **perception channel**:

| Axis | Channel | A sign looks like |
|------|---------|-------------------|
| Aspect | **Residue** | weeping wax, frost-rime, rot-bloom on the stone |
| Frailty | **Stress-mark** | how it flinches, what mark it shows when hurt |
| Ward | **Reaction** | how it answers a probe (see [investigation-and-probing.md](investigation-and-probing.md)) |
| Disposition | **Spoor** | tracks, spacing, the cadence of its movement |
| Rite-key | **Liturgy** | sigils, resonance, the shape of its devotions |
| Tell | **Omen** | the wind-up, the held breath before the lethal blow |

The **map from a trait value to its sign is fixed game-truth**: "weeping wax" always
means a heat-vulnerability, every expedition, for every player. What changes is *which
Incarnate carries it*, because the trait roll is re-rolled (TD-015). So players never
memorize monsters; they learn a **vocabulary**, and that vocabulary is genuine,
transferable skill (Pillar 2). A Seeker is a doctor: learn the language of symptoms,
diagnose each new patient.

### Origin is the dialect

An Incarnate's **Origin** (Belief / Sin / Relic) colors *how* its signs present without
changing what they mean: a Sin-born's heat-residue reads as scorched penitence, a
Relic-born's as wax bled from a reliquary. Same meaning, different accent. This is where
the lore families become the texture of the reading (TD-015).

### Mutations bend the language

At higher tiers, a **mutation** can mask a sign (it is absent), invert it (it lies), or
add a phantom one. This is what turns a master-tier read into forensics: you can no
longer trust a sign at face value, and the falsifiable Origin (TD-015) may itself be the lie.

## Non-negotiable Rules

1. The trait roll **never crosses the wire**; only derived signs do (CLAUDE.md invariant 3, netcode I5).
2. A sign is **never a label or a percentage** (vision.md non-negotiable 2). "Weeping wax", never "weakness: fire 80%".
3. The map is **stable game-truth**: the same trait value always yields the same sign meaning. The language is consistent across all expeditions and players.
4. The language is **never persisted as an unlock** (TD-006). Mastery lives in the player's skill and the session Archive, not in the account.

## Implementation Notes

- **Data shape (server-only):** `Sign = { channel: Channel, token: SignToken, intensity?: number }`. `deriveSigns(incarnate): Sign[]` is a pure function over the trait roll; it is the only thing that reads traits and the only producer of signs.
- The **map is data** (a table from `{ axis, value }` to a `SignToken`), so the lexicon scales to hundreds of entries without code changes.
- **Origin dialect** is a presentation modifier applied to the token, not a change of meaning.
- **Mutation operators** (`mask`, `invert`, `add`) are applied after derivation, before broadcast.
- **Per-player filtering:** a player only receives signs for channels they perceive (see [distributed-perception.md](distributed-perception.md)); the server filters per recipient. This is new code; no prototype logic is reused.
- Tier (TD-014) gates which channels are active for a given Incarnate.

## Future Expansion

- The **sign lexicon catalog** (the full value-to-token table) as data in [../content/](../content/).
- **Origin dialects** authored per family.
- **Compound and ambiguous signs** at master tier, where one observation supports two readings.
