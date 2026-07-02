<br>
<div align="center">

# Testament

### *A cooperative hunting RPG you win by understanding, not by memorizing.*

You and up to three companions are **hunter-scholars of the Collegium**. You take a
contract, form a theory about the Incarnate you are sent to study, stake your
preparation on that theory, and find out in the field whether you read it right.

![Godot](https://img.shields.io/badge/Godot-478CBF?style=flat&logo=godotengine&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=nodedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![WebSocket](https://img.shields.io/badge/WebSocket-010101?style=flat&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-6E9F18?style=flat&logo=vitest&logoColor=white)

**No installs. No app stores. Open a link and play.**

</div>

---

## The spine

> **Observe → Hypothesize → Test → Record.**

Testament is the scientific method dressed as a gothic hunt. Each Incarnate's traits
are hidden and re-rolled, so you can never memorize one: you read it from the *signs*
it leaves, and the fiction agrees, because in this world no complete answer exists,
only classification from observable facts.

## The five pillars

1. Preparation is as important as combat.
2. Knowledge is progression.
3. Incarnates are understood through interpretation, never memorization.
4. Cooperation is the primary pillar (solo supported, never the center).
5. Every expedition becomes another Testament.

## Foundations

An authoritative Node server (ephemeral in-memory rooms, a 20Hz tick, seeded
procedural generation, a strict client/server trust boundary) with a Godot client.
The design and decision history live in [docs/](docs/README.md).

## Design bible

The full design, lore, systems, and engineering docs live in
[docs/](docs/README.md), a modular bible. Start with the
[vision](docs/vision.md) and the [gameplay loop](docs/gameplay.md), then the
[technical overview](docs/technical.md), the [roadmap](docs/ROADMAP.md), and the
[decision log](docs/DECISION_LOG.md).

## Architecture

```
src/
  server/   authoritative. All game state lives here. Never trust client input.
  shared/   the wire-protocol contract. Types + constants only. No game logic.
client/      Godot 4 project (render + input only; untrusted). [planned]
```

Transport is raw WebSocket so Godot's `WebSocketPeer` connects natively and exports
cleanly to HTML5. The server stays the single source of truth.

## Running locally (server + shared)

```bash
# Prerequisites: Node >= 20, pnpm >= 9
pnpm install
pnpm dev:server     # run the authoritative server
pnpm test           # run server + shared tests
```

---

<div align="center">

*Built spec-first. Every mechanic is a requirement before it is a line of code.*

</div>
