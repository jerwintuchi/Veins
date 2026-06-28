# Decision Log — Testament

Append-only. Never edit a past entry; only add new ones. Each entry records a
decision, the context that forced it, and the consequences that follow.

The Veins prototype's decision log is preserved unaltered at
[archive/veins/DECISION_LOG.md](archive/veins/DECISION_LOG.md).

---

## TD-001 — Reboot: Veins → Testament (2026-06-28)

**Decision.** Treat Veins as a finished prototype and build a new game, Testament,
on its technical foundations. This is not a refactor; it is a new game.

**Context.** Veins validated the multiplayer architecture (authoritative server,
ephemeral rooms, seeded procedural generation) but its design (Circulatory Board,
Bleed Clock, doctrine system) is being replaced wholesale.

**Consequences.** Kept: the Node authoritative server, room/session lifecycle, 20Hz
tick, seeded RNG, dungeon/layout generation, movement, collision, projectiles,
pathfinding, separation, and the trust boundary. Retired: all Veins game *rules*.
The React/Phaser client is replaced by a Godot client (TD-002). Veins docs moved to
`docs/archive/veins/`. The Veins WIP is preserved on branch `testament-reboot` at
checkpoint `7983aba`; `master` stays at the last clean Veins commit as a reference.

## TD-002 — Client = Godot 4.x; transport = raw WebSocket (2026-06-28)

**Decision.** Replace the React/Phaser client with a Godot 4.x (GDScript) top-down
2D pixel-art client exported to HTML5, and migrate the server transport from
Socket.io to **raw WebSocket with a JSON message envelope**.

**Context.** Godot speaks raw `WebSocketPeer` natively and exports cleanly to HTML5.
Socket.io layers its own Engine.IO handshake on top of WebSocket, which Godot does
not speak natively; community Socket.io clients are fragile. The server's handler
core is already abstracted behind an interface, so the boundary swap is contained.

**Consequences.** The wire protocol becomes the single source of truth and must be
language-neutral (TypeScript server, GDScript client honoring the same shapes).
`src/shared` shifts from "TypeScript types both halves import" to "the protocol
contract the server implements and the client mirrors." `@veins/shared` and other
Veins-named packages will be renamed in a later pass.

## TD-003 — Core spine: the scientific method as a co-op hunt (2026-06-28)

**Decision.** The core loop is **Observe → Hypothesize → Test → Record**. Players
read an Incarnate, form a theory, bet their preparation on it, and record the verdict.

**Context.** Considered three spines: diagnosis-first (A), counter-build/adaptive
hunt (B), and collective-inquiry arc (C). The chosen design grounds A's diagnosis in
B's pre-expedition preparation and a fallible hypothesis, with C reduced to a
session-scoped party knowledge base. This is the configuration where all five pillars
are load-bearing and that is furthest from "Monster Hunter with cathedrals."

**Consequences.** Every system is reviewed against the spine. The full loop is
specified in [gameplay.md](gameplay.md); the constitution is [vision.md](vision.md).

## TD-004 — No doom clock; commitment via Surety + Recant + reactive pressure (2026-06-28)

**Decision.** Field pressure is diegetic and reactive (rising Incarnate awareness,
decay, weather, closing routes), never a timer. Commitment is staked at acceptance
(the Surety); abandoning a contract (Recant) costs the stake and standing, with no
death-lock. A failed or recanted expedition still writes a Field Testament.

**Context.** A doom clock punishes careful investigation, which is the exact skill
Pillar 3 rewards. The question "does the game have to punish hesitation?" is answered:
it punishes recklessness and poor preparation, not deliberation.

**Consequences.** Preserves the prototype's extraction-tension feeling without the
Bleed Clock. Makes Pillar 5 literally true (failure teaches) and makes failure
productive for a co-op game where wipes happen.

## TD-005 — Interpretation model: sign language + active probing (2026-06-28)

**Decision.** Hidden Incarnate traits manifest as a **legible sign language**:
consistent, observable signs whose meaning is stable game-truth, plus **active
probing** to test the thing in the field. Each Incarnate's specific trait roll is
hidden and re-rolled per expedition.

**Context.** Pillar 3 forbids memorization but must not become blind guessing. The
sign language is the bridge: players learn a vocabulary (skill), then diagnose each
fresh roll (interpretation). A hunter-scholar is a doctor reading symptoms.

**Consequences.** The trait roll never leaves the server (CLAUDE.md invariant 3); the
wire carries only signs. The sign language is never a label, a percentage, or a
persisted unlock. The forced-cooperation engine is **distributed perception**:
party members perceive different sign-channels and must assemble the theory by talking.

## TD-006 — Persistence split: thin account layer only (2026-06-28)

**Decision.** Persist only identity, cosmetics, Collegium rank, customization, and
career stats. Everything about an expedition, including the party's session Archive,
is ephemeral and lives in server memory only.

**Context.** Knowledge-as-progression (Pillar 2) is satisfied by player *skill* and a
session-scoped Archive, not by a persisted knowledge database. Collegium rank grants
access and options, not raw power, to avoid a stat grind that would dull the roguelike.

**Consequences.** Supabase (or its successor) survives only for the thin account
layer. No game-state persistence mid-expedition. Server restart loses active
expeditions (acceptable; sessions are short).

## TD-007 — Loadout (bag) economy forces and shares roles (2026-06-28)

**Decision.** A limited shared bag forces a tradeoff between combat capability and
probing/ritual gear. Parties either specialize (a fragile investigator) or spread the
tools (resilient, less peak performance).

**Context.** Raised by the user as the link between preparation and role distribution.

**Consequences.** Pillar 1 (preparation) and Pillar 4 (cooperation) become the same
decision. Relic and rite *combinations* live in the loadout. Bag-slot budget is open
tuning, deferred to a spec.

## TD-008 — Party scaling: 1 to 4 players, solo fully supported (2026-06-28)

**Decision.** The game must feel complete at 1, 2, 3, and 4 players. Solo is fully
supported and never treated as lacking; co-op remains the design center.

**Context.** Not all players have friends available; party size must not be a
constraint on access. Distributed perception relaxes for solo (a lone scholar
perceives all channels but is stretched thin).

**Consequences.** Difficulty and the perception model scale with party size; the game
does not become a different game per size. This is a standing constraint on every
system design.

## TD-009 — Combat stays real-time top-down action (2026-06-28)

**Decision.** Keep real-time, top-down action combat (the prototype's 20Hz tick,
projectiles, movement), reskinned for gothic weight and tone.

**Context.** Matches the art direction (Blasphemous, Castlevania) and preserves the
most-reusable server technology.

**Consequences.** The combat tick and projectile systems carry over with reflavoring;
the doctrine/synergy/Bleed-Clock logic layered on top of them does not.

## TD-010 — Lore metaphysics: present God, sacred decay, unresolved Incarnates (2026-06-28)

**Decision.** The fiction rests on three canon pillars: (1) there is one true,
reigning, holy God, genuinely present, not dead or absent, whose apparent "silence"
is a subjective human reading; (2) reality undergoes an ongoing **sacred decay** with
no single slayable author; (3) **Incarnates** are phenomena born of belief, sin, or
broken relics whose true nature is never resolved, only classified from observable
facts. The Collegium hunts as "the last attempt to understand reality," with
historical (not magical) authority, to witness, contain, or redeem rather than to
kill for loot. The **Choirs** are generational doctrinal lineages that disagree.

**Context.** Set by the Creative Director answering the three lore questions left open
at the Phase 0 gate. The "no universal answer, only classification from observable
facts" principle makes the sign-language mechanic a truth of the world, not a game
concession (Lore = Mechanics).

**Consequences.** Enforced in code by invariant 3 (the Incarnate trait roll never
leaves the server; only signs do). Forbids any "true nature" reveal, any dead-god
framing, and any cause-boss whose death repairs reality. Proper nouns (God's name,
the world, the founding events, specific Choirs, the order's saying, the
miracle-moment system) remain open for the Director. Full fiction in docs/lore.md and
docs/lore/.
