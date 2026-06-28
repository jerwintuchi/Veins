# Glossary — Canonical Terms

Use these terms exactly as written in the bible, in specs, in code, and in
conversation. Consistency prevents drift.

---

**The Collegium**
The order the players belong to: hunter-scholars who study and confront
Manifestations. The institutional frame for contracts, ranks, and the Archive.

**Hunter-Scholar**
A player character. Not a hero and not a class. A field investigator who survives
by understanding. Roles emerge from the loadout, not from a class pick.

**Aspirant**
A Collegium member before initiation. Not yet a Seeker.

**Seeker**
A confirmed hunter-scholar; the baseline player identity. Named for the Collegium
creed, *"we seek truth, not certainty."*

**Witness**
The earned honorific for a Seeker who has survived expeditions, "because they have
seen." Aligns with the higher Collegium Rank bands. A title, never a class.

**Choir**
A historical generation of hunters, a lineage within the Collegium. Choirs are
*heritage and flavor*, not playable classes. (Heir to the prototype's rejection of
class selection.)

**The Sovereign One**
The one true, reigning God of the world. Addressed by many epithets that encode the
speaker's theology (the Silent Watcher, the Grand Architect, and others); the
plurality is canon and never resolves whether God is silent.

**Manifestation**
An unconfirmed hostile phenomenon in the field. The general term for enemies before
the Collegium has verified what they are.

**Incarnate**
A confirmed, named entity that an expedition is sent to study or confront. Each
Incarnate has an **Origin**, a hidden **Trait Roll**, and may carry a **Mutation**
stack. Understood through interpretation, never memorization.

**Origin**
An Incarnate's genus: **Belief** (corrupted thought), **Sin** (corrupted deed), or
**Relic** (corrupted matter). Asserted by the contract but falsifiable, and possibly
hybrid. Origin colors a hunt (sign dialect, rites, site, behavior) but never dictates
the approach; that comes from the contract axes.

**Trait Roll**
The hidden, server-only set of an Incarnate's properties for one expedition
(Aspect, Frailty, Ward, Disposition, Rite-key, Tell). Re-rolled every expedition.
Never sent to the client; only its **Signs** are.

**Mutation**
A modifier stacked onto an Incarnate that masks, inverts, or adds signs, keeping even
a familiar Incarnate a fresh diagnosis.

**Sign**
An observable, consistent manifestation of a hidden trait (a mark, a sound, a
behavior, a reaction). The same sign always means the same thing; which Incarnate
carries it varies. Signs are the only Incarnate information the client ever receives.

**Sign Language**
The stable vocabulary that maps signs to meanings. It is game-truth, learned as
player skill, never shown as a label or a percentage and never persisted as an
unlock. Mastery of the sign language *is* progression (Pillar 2).

**Perception Channel**
One of the senses through which signs are read (Residue, Stress-mark, Reaction,
Spoor, Liturgy, Omen). Each trait axis emits to one channel; the loadout decides
which channels a Seeker can read.

**Probe**
An active investigation action: present a relic, ring a bell, expose the Incarnate
to a stimulus, and read the reaction. Costs bag space and exposure.

**Distributed Perception**
The forced-cooperation engine: party members perceive different sign-channels, so
the theory can only be assembled by talking. Solo perceives all channels but is stretched.

**Contract**
A procedural mission assembled from orthogonal axes: Target, Site, Condition,
Primary Verb, Secondary Objective, and Clause. Its intel is partial and may be wrong.

**Primary Verb**
The contract's main objective. Not always *kill*: capture alive, observe-and-survive,
banish by rite, or drive off.

**Secondary Objective**
A complication layered onto a contract (escort, rescue, retrieve, interact, defend).
Must always be a lever on the central hunt, never a chore beside it.

**Clause**
A Collegium-imposed restriction on a contract (bring it back intact, no fire on
consecrated ground, the reliquary must not break).

**Loadout / Bag Economy**
The shared kit the party prepares. Limited bag space forces a tradeoff between
combat capability and probing/ritual gear, which is how preparation and role
distribution become the same decision.

**Stipend**
The Collegium's per-contract allowance, spent to requisition the loadout and to place
the Surety. The deliberate, skill-based layer of preparation.

**Blessing**
A pre-expedition rite: each Seeker petitions and *receives* (unchosen) an ephemeral
divine attribute. A wildcard whose worth depends on the Incarnate, capped below the
swing of a correct read. Per-Seeker, one expedition, never persistent power.

**Surety**
The stake placed when a contract is accepted. Makes acceptance a real decision and
gives preparation teeth.

**Recant**
Abandoning an accepted contract. Allowed, but it forfeits the Surety and costs some
Collegium standing. There is no death-lock.

**Expedition**
One full deployment against a contract, from Deploy to Extraction (or failure).

**Extraction**
Leaving the site with what you learned and what you carry.

**The Archive**
The party's shared, **session-scoped** notebook of confirmed Incarnate traits for
the current run of expeditions. Ephemeral: it resets with a new session.

**Field Testament**
The record an expedition produces, win or lose. Failure still writes one; partial
knowledge enters the Archive. The namesake of the game (Pillar 5).

**Collegium Rank**
A persistent measure of standing that gates access to higher-tier contracts and
prestige. It grants *access and options*, not raw combat power.

**Site / Condition**
The Site is the biome an expedition takes place in (route topology + modifiers). The
Condition is the weather, time, and sacred-decay state layered on top.

**Trust Boundary**
The architectural line between `src/server/` (authoritative, trusted) and the Godot
client (untrusted). No game state originates on the client side. `src/shared/` sits
on the line as the wire-protocol contract: types and constants only.

**Delta Event**
A server-to-client message describing a *change* to game state. After the initial
sync on join, the server sends deltas only (exception: explicit resync on
reconnection or desync recovery).
