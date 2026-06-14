# Glossary — Canonical Terms

Use these terms exactly as written in specs, code, and conversation. Consistency prevents drift.

---

**Bleed Clock**
The dungeon's global HP bar. Drains in real time; drain rate multiplies with floor depth. Hitting zero ends the run. Creates the "extract or descend?" group tension. Implemented server-side; broadcast to all clients as a delta event.

**Circulatory Board**
The shared hexagonal relic board owned by the entire party (not individual players). Relics only fire their synergy (strongest) effect when adjacent to a compatible relic owned by a *different* player. The central mechanic of Veins.

**Linked Fates**
The revive mechanic. Reviving a downed teammate costs the reviver one relic from their board slots, which transfers into the downed player's slot. Death reshapes the party build mid-fight.

**Relic**
An item placed on the Circulatory Board. Has: a base effect (always active), a synergy effect (fires only when adjacency conditions are met), and one or more tags (e.g., `fire`, `aoe`, `party`, `poison`).

**Relic Slot**
A single hex cell on the Circulatory Board. Has a coordinate (HexCoord), an owner (PlayerId), and optionally a placed Relic. Ownership determines whose player border is rendered; synergy ignores ownership except to require *different* owners.

**Synergy**
The bonus effect a relic gains when it is adjacent to another relic (owned by a different player) that shares at least one tag. Evaluated server-side only. Pure function of board state.

**HexCoord**
Axial coordinate pair `{ q: number, r: number }` used to address cells on the Circulatory Board. Six neighbors at offsets `(±1, 0)`, `(0, ±1)`, `(+1, −1)`, `(−1, +1)`.

**Run**
One full dungeon session from start to extraction or death. Identified by a `runId` (UUID). The `runId` seeds all procedural generation for that session.

**Room**
An in-memory server object containing 2–4 players, the current run state, and the Circulatory Board. Rooms are ephemeral — never persisted to the database.

**Meta-progression**
Cross-run persistent data: unlocked relics, cosmetics, achievement flags. Stored in Supabase. The only data that hits the database.

**Trust Boundary**
The architectural line between `src/server/` (authoritative, trusted) and `src/client/` (untrusted). No game state originates from the client side of this boundary. `src/shared/` sits on the line — types and constants only.

**Delta Event**
A Socket.io event emitted by the server describing a *change* to game state (e.g., `RELIC_PLACED`, `BLEED_CLOCK_TICK`). Clients apply deltas to their local render state. Clients never compute state; they only render what the server tells them.

**R# / T# (Requirement / Task)**
Traceability IDs used in specs. R# appears in `requirements.md`. T# appears in `tasks.md` and cites the R# it implements plus the test that verifies it. Nothing is done without this chain: R# → Design → T# → Test.
