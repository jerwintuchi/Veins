# Solo Play — Requirements

## Context
Veins is designed as forced co-op: the Circulatory Board's synergy fires only between
relics owned by *different* players (GLOSSARY: Synergy; invariant I5). In a 1-player run
every board cell is owned by the lone player, so no synergy can ever fire and the core
build mechanic is dead. This spec makes solo a first-class, playable mode by relaxing the
ownership rule **for solo runs only**, leaving co-op unchanged.

Decision recorded in DECISION_LOG (2026-06-24).

## Functional Requirements

**R1** — A run can start with a single player.
- AC: `MIN_PLAYERS_TO_START === 1` (exported from `@veins/shared`).
- AC: `RoomManager.startRun` on a room with exactly one player returns `{ ok: true }`
  and produces an in-progress room with a fully-owned board.

**R2** — On a solo board, the synergy ownership requirement is relaxed.
- AC: given a board whose every slot shares one `ownerId`, two adjacent relics that share
  at least one tag BOTH report `synergyFires === true` from `evaluateSynergies`.
- AC: relics with no shared tag still do not synergize (tag rule still applies).

**R3** — Co-op synergy behaviour is unchanged.
- AC: on a board with two or more distinct `ownerId`s, two adjacent relics owned by the
  *same* player do NOT synergize (owner isolation preserved).
- AC: on such a board, adjacent relics owned by *different* players that share a tag DO
  synergize.

**R4** — The lobby lets a lone host start a solo run.
- AC: `WaitingRoom` enables "Start Run" when `players.length >= MIN_PLAYERS_TO_START`
  (i.e. 1), and shows no "need more players" block in that case.

## Correctness Properties

**P1** — Solo detection is a pure function of board state. `evaluateSynergies` derives
solo-ness from the set of slot owners only — no globals, no `Math.random`, no player-count
parameter. Same board → same result.

**P2** — Determinism is preserved: `evaluateSynergies(board)` returns identical output on
repeated calls for both solo and co-op boards.
