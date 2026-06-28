# Requirements — Relic Board UI

The Circulatory Board is the central mechanic. Players need to see it, pick
relics, and place them during the loot phase. This spec wires the existing
server-side `place-relic` handler to a client React overlay and gives the run
a starter relic pool so placement is possible from day one.

Out of scope: relic loot drops per floor, animated synergy effects, relic
removal outside of Linked Fates, drag-and-drop placement, relic stat tuning.

---

**R1**: A fixed set of 6 starter relics is defined in `src/shared/src/relics.ts`
and exported from `src/shared/src/index.ts`.
- AC: `STARTER_RELICS` is a `Relic[]` of exactly 6 entries, each with a unique
  `id`, non-empty `name`, at least one `RelicTag`, and non-empty `baseEffect`
  and `synergyEffect` descriptions
- AC: The 6 relics form 3 tag-pairs: 2 with `'fire'`, 2 with `'chain'`, 2 with
  `'shield'` — ensuring synergy is always achievable between adjacent players
- AC: `STARTER_RELIC_IDS` (string[]) exported alongside for O(1) lookup

**R2**: `RoomManager.startRun` populates `room.registry` with all 6 starter
relics so placement is possible on floor 1.
- AC: After `startRun`, `room.registry.size === STARTER_RELICS.length`
- AC: Each relic in `room.registry` matches the corresponding entry in
  `STARTER_RELICS` (id, name, tags, effects all preserved)

**R3**: `RUN_STARTED` carries the relic registry so clients can render relic
cards without a separate sync round-trip.
- AC: The `RUN_STARTED` socket event payload includes
  `relicRegistry: Record<RelicId, Relic>` (plain object, not a Map)
- AC: The existing `board` and `synergyMap` fields remain unchanged

**R4**: `BoardPanel` React component renders the 19-cell hex grid as an SVG
overlay during the loot phase.
- AC: One `<polygon>` per slot; each polygon's fill color reflects the
  slot's owner (local player = `#4488ff`, first remote = `#ff8844`, second =
  `#44cc44`, third = `#cc44ff`)
- AC: A slot that holds a relic shows the relic's name as a `<text>` child
  inside the polygon
- AC: A slot whose `relicId` is active in `synergyMap` gets a visible stroke
  highlight (`stroke: '#ffff00'`, `strokeWidth: 3`)
- AC: `BoardPanel` is invisible when `phase !== 'loot'`

**R5**: `BoardPanel` contains a `RelicTray` — a horizontal strip below the hex
grid showing all relics in the registry that are not yet placed on the board.
- AC: A relic card is shown for every registry entry whose `id` does not appear
  in any slot's `relicId`
- AC: Clicking a relic card selects it (visual highlight; stored in component
  state, not emitted to server)
- AC: Clicking the same card again deselects it

**R6**: Clicking an owned empty slot while a relic is selected emits
`place-relic` to the server.
- AC: The click only triggers if: slot `ownerId === localPlayerId`, slot
  `relicId === null`, and a relic is currently selected
- AC: The `place-relic` payload is `{ coord: HexCoord, relicId: string }`
- AC: After emitting, the selected relic is deselected (optimistic reset to
  avoid double-sends)

**R7**: The board display updates on `RELIC_PLACED` and `BOARD_STATE_SYNC`.
- AC: `RELIC_PLACED` updates the slot in the local board state (sets
  `relicId`) and applies the new `synergyMap`
- AC: `BOARD_STATE_SYNC` replaces the entire local board state
- AC: The synergy highlight re-renders on every board state change

**R8**: `BoardPanel` is wired into `App.tsx` and receives `socketRef`,
`localPlayerId`, and the initial `phase`.
- AC: `App.tsx` renders `<BoardPanel>` alongside `<HUD>` and
  `<VirtualJoystick>`
- AC: `phase` is stored in App state, updated by the `PHASE_CHANGED` socket
  event (already fired by the server on combat→loot transition)
