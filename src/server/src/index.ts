// Authoritative game server. Thin Socket.io plumbing over the unit-tested core
// (RoomManager, board layout, placement, linked fates, dungeon). Every inbound
// message is validated; only the server mutates room state (invariants I1, I2).
import { fileURLToPath } from 'node:url';
import type {
  JoinRoomRequest,
  PlaceRelicRequest,
  LinkedFatesRequest,
  RoomSummary,
  PlayerId,
  RoomCode,
} from '@veins/shared';
import { BLEED_TICK_INTERVAL_MS, hexCoordKey } from '@veins/shared';

// How often the server ticks enemy AI and broadcasts combat events (R12).
const COMBAT_TICK_MS = 100;
import { RoomManager } from './room/manager.js';
import type { Room } from './room/state.js';
import { bleedStageOf } from './room/state.js';
import { placeRelic } from './board/placement.js';
import { reviveWithLinkedFates } from './board/linkedFates.js';
import { evaluateSynergies } from './board/synergy.js';
import { movePlayer } from './combat/movement.js';
import { stepCombat } from './combat/roomCombat.js';
import { selectAutoAimTarget } from './combat/autoAim.js';
import { tryAutoFire, stepProjectiles } from './combat/weapon.js';
import { generateLootPool } from './loot/pool.js';
import {
  scoreRelicPlaced,
  scoreEnemyKilledByTumor,
  scoreBurstKill,
  scoreExtract,
  scoreLinkedFatesRevive,
  scoreRelicRemoved,
  applyDoctrineThresholds,
} from './doctrine/scoring.js';

// Minimal Socket.io surface we depend on. Keeping it abstract makes the wiring
// testable without a live server; the real io is cast to this at the boundary.
export interface ServerSocket {
  id: string;
  data: { playerId?: PlayerId; roomCode?: RoomCode | undefined };
  on(event: string, listener: (payload: unknown) => void): void;
  emit(event: string, payload: unknown): void;
  join(room: string): void;
}
export interface RoomEmitter {
  emit(event: string, payload: unknown): void;
}
export interface SocketIOServerLike {
  on(event: 'connection', listener: (socket: ServerSocket) => void): void;
  to(room: string): RoomEmitter;
}

export function summarizeRoom(room: Room): RoomSummary {
  return { code: room.code, status: room.status, hostId: room.hostId, players: room.players };
}

// Shape guards for untrusted socket payloads (I2). A malformed coord must yield
// a targeted error, never an exception thrown inside an event listener.
function isCoord(c: unknown): c is { q: number; r: number } {
  return (
    typeof c === 'object' &&
    c !== null &&
    typeof (c as { q: unknown }).q === 'number' &&
    typeof (c as { r: unknown }).r === 'number'
  );
}

export function registerHandlers(io: SocketIOServerLike, manager: RoomManager): void {
  io.on('connection', (socket) => {
    // In production, playerId comes from the authenticated handshake. Fall back
    // to the socket id so the identity is always server-derived, never a client
    // payload field (invariant I2).
    const playerId: PlayerId = socket.data.playerId ?? socket.id;
    socket.data.playerId = playerId;

    const currentRoom = (): Room | undefined =>
      socket.data.roomCode ? manager.getRoom(socket.data.roomCode) : undefined;

    socket.on('create-room', () => {
      const { room } = manager.createRoom(playerId);
      socket.data.roomCode = room.code;
      socket.join(room.code);
      socket.emit('ROOM_UPDATE', { room: summarizeRoom(room) });
    });

    socket.on('join-room', (payload) => {
      const req = payload as JoinRoomRequest;
      if (!req || typeof req.code !== 'string') {
        socket.emit('LOBBY_ERROR', { code: 'INVALID_REQUEST', message: 'Malformed join-room request.' });
        return;
      }
      const res = manager.joinRoom(req.code, playerId);
      if (!res.ok) {
        socket.emit('LOBBY_ERROR', res.error);
        return;
      }
      socket.data.roomCode = res.room.code;
      socket.join(res.room.code);
      io.to(res.room.code).emit('ROOM_UPDATE', { room: summarizeRoom(res.room) });
    });

    socket.on('leave-room', () => {
      const code = socket.data.roomCode;
      if (!code) return;
      const res = manager.leaveRoom(code, playerId);
      socket.data.roomCode = undefined;
      if (res.ok && !res.deleted && res.room) {
        io.to(code).emit('ROOM_UPDATE', { room: summarizeRoom(res.room) });
      }
    });

    socket.on('start-run', () => {
      const code = socket.data.roomCode;
      if (!code) {
        socket.emit('LOBBY_ERROR', { code: 'NOT_IN_ROOM', message: 'You are not in a room.' });
        return;
      }
      const res = manager.startRun(code);
      if (!res.ok) {
        socket.emit('LOBBY_ERROR', res.error);
        return;
      }
      io.to(code).emit('RUN_STARTED', {
        dungeon: res.dungeon,
        board: res.room.board,
        synergyMap: evaluateSynergies(res.room.board, res.room.registry),
        relicRegistry: Object.fromEntries(res.room.registry),
        lootPool: res.room.lootPool,
        phase: res.room.phase,
        playerPositions: Object.fromEntries(
          [...res.room.playerStates.entries()].map(([id, s]) => [id, { x: s.x, y: s.y }])
        ),
      });
      // Broadcast floor-1 enemies spawned at run start.
      for (const [id, e] of res.room.enemies) {
        io.to(code).emit('ENEMY_SPAWNED', { enemyId: id, typeId: e.typeId, x: e.x, y: e.y, hp: e.hp });
      }
    });

    socket.on('place-relic', (payload) => {
      const room = currentRoom();
      if (!room) {
        socket.emit('RELIC_PLACE_ERROR', { code: 'INVALID_COORD', message: 'You are not in an active room.' });
        return;
      }
      const req = payload as PlaceRelicRequest;
      if (!req || !isCoord(req.coord) || typeof req.relicId !== 'string') {
        socket.emit('RELIC_PLACE_ERROR', { code: 'INVALID_COORD', message: 'Malformed place-relic request.' });
        return;
      }
      if (!room.lootPool.includes(req.relicId)) {
        socket.emit('RELIC_PLACE_ERROR', { code: 'RELIC_NOT_IN_POOL', message: 'That relic is not in the current loot pool.' });
        return;
      }
      const result = placeRelic(room.board, req, playerId, room.phase, room.registry);
      if (!result.ok) {
        socket.emit('RELIC_PLACE_ERROR', result.error);
        return;
      }
      room.board = result.board;
      room.lootPool = room.lootPool.filter(id => id !== req.relicId);
      io.to(room.code).emit('RELIC_PLACED', result.event);

      scoreRelicPlaced(room, req.relicId, req.coord, playerId);
      for (const flavor of applyDoctrineThresholds(room)) {
        io.to(room.code).emit('BOARD_DOCTRINE_SHIFT', { flavor });
      }
    });

    socket.on('revive', (payload) => {
      const room = currentRoom();
      if (!room) {
        socket.emit('LINKED_FATES_ERROR', { code: 'INVALID_COORD', message: 'You are not in an active room.' });
        return;
      }
      // Phase guard: Linked Fates is only meaningful during active combat (R11, P6).
      if (room.phase !== 'combat') {
        socket.emit('LOBBY_ERROR', { code: 'WRONG_PHASE', message: 'Revive is only allowed during combat.' });
        return;
      }
      const req = payload as LinkedFatesRequest;
      if (!req || !isCoord(req.sourceCoord) || !isCoord(req.targetCoord)) {
        socket.emit('LINKED_FATES_ERROR', { code: 'INVALID_COORD', message: 'Malformed revive request.' });
        return;
      }
      // Penitent tier-1: free revive token — skip relic sacrifice, just restore HP.
      if (room.penitentFreeRevive) {
        room.penitentFreeRevive = false;
        const freeSlot = room.board.slots[hexCoordKey(req.targetCoord)];
        const freeRevivedId = freeSlot?.ownerId;
        const freePs = freeRevivedId !== undefined ? room.playerStates.get(freeRevivedId) : undefined;
        if (!freeRevivedId || !freePs) {
          socket.emit('LINKED_FATES_ERROR', { code: 'INVALID_COORD', message: 'Revived player state not found.' });
          return;
        }
        room.playerStates.set(freeRevivedId, { ...freePs, hp: freePs.maxHp, downed: false });
        io.to(room.code).emit('PLAYER_REVIVED', { playerId: freeRevivedId, hp: freePs.maxHp });
        return;
      }

      // reviverId is forced to the authenticated player, never trusted from the client.
      const result = reviveWithLinkedFates(
        room.board,
        { reviverId: playerId, sourceCoord: req.sourceCoord, targetCoord: req.targetCoord },
        room.registry
      );
      if (!result.ok) {
        socket.emit('LINKED_FATES_ERROR', result.error);
        return;
      }
      room.board = result.board;
      for (const e of result.events) io.to(room.code).emit(e.type, e.payload);

      // Restore the downed player's HP and clear downed flag (R11).
      // The target coord's owner is the player being revived.
      const targetSlot = room.board.slots[hexCoordKey(req.targetCoord)];
      const revivedId = targetSlot?.ownerId;
      const ps = revivedId !== undefined ? room.playerStates.get(revivedId) : undefined;
      if (!revivedId || !ps) {
        // Board mutation already committed; state lookup failed — emit error to requester.
        socket.emit('LINKED_FATES_ERROR', { code: 'INVALID_COORD', message: 'Revived player state not found.' });
        return;
      }
      // Return a new PlayerState object rather than mutating in place (immutability convention).
      room.playerStates.set(revivedId, { ...ps, hp: ps.maxHp, downed: false });
      io.to(room.code).emit('PLAYER_REVIVED', { playerId: revivedId, hp: ps.maxHp });

      // Doctrine: Penitent +4 for Linked Fates revive (relic sacrifice + revive).
      scoreLinkedFatesRevive(room);
      scoreRelicRemoved(room);
      for (const flavor of applyDoctrineThresholds(room)) {
        io.to(room.code).emit('BOARD_DOCTRINE_SHIFT', { flavor });
      }
    });

    socket.on('extract', () => {
      const code = socket.data.roomCode;
      if (!code) {
        socket.emit('LOBBY_ERROR', { code: 'NOT_IN_ROOM', message: 'You are not in a room.' });
        return;
      }
      const extractingRoom = manager.getRoom(code);
      if (!extractingRoom) {
        socket.emit('LOBBY_ERROR', { code: 'INVALID_REQUEST', message: 'No active run to extract from.' });
        return;
      }
      // Score before extractRoom mutates status (we need bleedClock to determine voluntary vs forced).
      scoreExtract(extractingRoom);
      const extractFlavors = applyDoctrineThresholds(extractingRoom);

      const res = manager.extractRoom(code);
      if (!res.ok) {
        socket.emit('LOBBY_ERROR', { code: 'INVALID_REQUEST', message: 'No active run to extract from.' });
        return;
      }
      io.to(code).emit('RUN_ENDED', res.ended);
      for (const flavor of extractFlavors) {
        io.to(code).emit('BOARD_DOCTRINE_SHIFT', { flavor });
      }
    });

    socket.on('descend', () => {
      const code = socket.data.roomCode;
      if (!code) {
        socket.emit('LOBBY_ERROR', { code: 'NOT_IN_ROOM', message: 'You are not in a room.' });
        return;
      }
      // Descend is only valid during loot phase (fight → loot → descend cycle).
      // Allowing descend from combat would silently replace the current enemy map
      // mid-fight, which is an I2 trust-boundary violation.
      const existingRoom = manager.getRoom(code);
      if (existingRoom && existingRoom.phase !== 'loot') {
        socket.emit('LOBBY_ERROR', { code: 'WRONG_PHASE', message: 'Can only descend during loot phase.' });
        return;
      }
      const res = manager.descendRoom(code);
      if (!res.ok) {
        socket.emit('LOBBY_ERROR', { code: 'INVALID_REQUEST', message: 'No active run to descend.' });
        return;
      }
      io.to(code).emit('FLOOR_ADVANCED', res.event);
      // Emit one ENEMY_SPAWNED per enemy so clients can render the new floor (R10).
      const room = manager.getRoom(code)!;
      for (const enemy of room.enemies.values()) {
        io.to(code).emit('ENEMY_SPAWNED', {
          enemyId: enemy.id,
          typeId: enemy.typeId,
          x: enemy.x,
          y: enemy.y,
          hp: enemy.hp,
        });
      }
    });

    // T4 (weapon spec) — move-player now only stores the direction vector.
    // The combat tick applies movement once per tick regardless of how many
    // move-player events arrive, closing the event-flood speed exploit (R4, P2).
    socket.on('move-player', (payload) => {
      const room = currentRoom();
      if (!room) {
        socket.emit('LOBBY_ERROR', { code: 'NOT_IN_ROOM', message: 'You are not in a room.' });
        return;
      }
      const req = payload as { dx: unknown; dy: unknown };
      if (!req || typeof req.dx !== 'number' || typeof req.dy !== 'number') {
        socket.emit('LOBBY_ERROR', { code: 'INVALID_REQUEST', message: 'Malformed move-player request.' });
        return;
      }
      // Store direction; tick will apply it. Guard: run not yet started.
      if (!room.playerMoveInputs.has(playerId)) return;
      room.playerMoveInputs.set(playerId, { dx: req.dx, dy: req.dy });
    });

    // T5 — aim-player: client sends a direction vector (or zero for auto-aim).
    // Zero vector → switch to auto mode. Non-zero → manual mode with normalized
    // vector. Movement is not phase-gated (R6).
    socket.on('aim-player', (payload) => {
      const room = currentRoom();
      if (!room) {
        socket.emit('LOBBY_ERROR', { code: 'NOT_IN_ROOM', message: 'You are not in a room.' });
        return;
      }
      const req = payload as { dx: unknown; dy: unknown };
      if (!req || typeof req.dx !== 'number' || typeof req.dy !== 'number') {
        socket.emit('LOBBY_ERROR', { code: 'INVALID_REQUEST', message: 'Malformed aim-player request.' });
        return;
      }
      const mag = Math.sqrt(req.dx * req.dx + req.dy * req.dy);
      const prev = room.aimStates.get(playerId);
      if (mag < 1e-6) {
        // Zero vector: switch to auto-aim (target resolved by next combat tick).
        const next = { mode: 'auto' as const, targetId: null };
        room.aimStates.set(playerId, next);
        const changed = !prev || prev.mode !== 'auto';
        if (changed) {
          io.to(room.code).emit('PLAYER_AIM_CHANGED', { playerId, mode: 'auto', targetId: null });
        }
      } else {
        const ndx = req.dx / mag;
        const ndy = req.dy / mag;
        const next = { mode: 'manual' as const, dx: ndx, dy: ndy };
        room.aimStates.set(playerId, next);
        const changed = !prev || prev.mode !== 'manual' || (prev as { dx: number }).dx !== ndx || (prev as { dy: number }).dy !== ndy;
        if (changed) {
          io.to(room.code).emit('PLAYER_AIM_CHANGED', { playerId, mode: 'manual', dx: ndx, dy: ndy });
        }
      }
    });

    socket.on('disconnect', () => {
      const code = socket.data.roomCode;
      if (!code) return;
      const res = manager.leaveRoom(code, playerId);
      if (res.ok && !res.deleted && res.room) {
        io.to(code).emit('ROOM_UPDATE', { room: summarizeRoom(res.room) });
      }
    });
  });
}

// One Bleed Clock step across all active rooms. Pure-ish (delegates to the
// unit-tested manager/clock); exported so the loop can be driven in tests.
export function runBleedTick(io: SocketIOServerLike, manager: RoomManager, deltaSeconds: number): void {
  for (const room of manager.activeRooms()) {
    const prevStage = bleedStageOf(room.bleedClock.current, room.bleedClock.max);
    const res = manager.tickRoom(room.code, deltaSeconds);
    if (!res) continue;
    io.to(room.code).emit('BLEED_CLOCK_TICK', res.tick);
    if (res.tick.stage !== prevStage) {
      io.to(room.code).emit('BLEED_STAGE_CHANGED', { stage: res.tick.stage });
    }
    if (res.ended) io.to(room.code).emit('RUN_ENDED', res.ended);
  }
}

// One combat AI step across all active combat-phase rooms. Exported for tests.
export function runCombatTick(io: SocketIOServerLike, manager: RoomManager, deltaSeconds: number): void {
  for (const room of manager.activeRooms()) {
    if (room.phase !== 'combat') continue; // skip loot/transition rooms

    // 1. Move players from stored direction inputs (rate-limited to one move per
    //    tick regardless of how many move-player events arrived, P2).
    for (const pid of room.players) {
      const ps = room.playerStates.get(pid);
      if (!ps || ps.downed || !room.dungeon) continue;
      const input = room.playerMoveInputs.get(pid) ?? { dx: 0, dy: 0 };
      const next = movePlayer(ps, input.dx, input.dy, deltaSeconds, room.dungeon);
      room.playerStates.set(pid, next);
      io.to(room.code).emit('PLAYER_MOVED', { playerId: pid, x: next.x, y: next.y });
    }

    // 2. Auto-fire projectiles for each player whose cooldown has expired.
    for (const pid of room.players) {
      const proj = tryAutoFire(room, pid, deltaSeconds);
      if (proj) {
        io.to(room.code).emit('PROJECTILE_FIRED', {
          projectileId: proj.id, playerId: pid,
          x: proj.x, y: proj.y, dx: proj.dx, dy: proj.dy,
        });
      }
    }

    // 3. Step projectiles: advance positions and resolve hits.
    //    Run before stepCombat so hp=0 enemies are detected as newly dead
    //    by tickEnemies' alive-check (weapon spec design.md ordering note).
    const hitResults = stepProjectiles(room, deltaSeconds);
    for (const result of hitResults) {
      io.to(room.code).emit('PROJECTILE_REMOVED', {
        projectileId: result.projectileId,
        reason: result.hit ? 'hit' : 'range',
      });
      if (result.hit) {
        io.to(room.code).emit('ENEMY_DAMAGED', { enemyId: result.enemyId, hp: result.newHp });
        // Relic effect secondaries: splash, chain
        for (const splash of result.splashHits) {
          io.to(room.code).emit('ENEMY_DAMAGED', { enemyId: splash.enemyId, hp: splash.newHp });
        }
        if (result.chainHit) {
          io.to(room.code).emit('ENEMY_DAMAGED', { enemyId: result.chainHit.enemyId, hp: result.chainHit.newHp });
        }
      }
    }

    // 4. Enemy AI: move, attack, mark hp=0 enemies dead, resolve phase transition.
    const res = stepCombat(room, deltaSeconds);
    if (!res.ok) continue;

    // Emit per-player damage and downed events.
    for (const ev of res.events) {
      const ps = room.playerStates.get(ev.targetId);
      if (!ps) continue;
      io.to(room.code).emit('PLAYER_DAMAGED', { playerId: ev.targetId, hp: ps.hp });
      if (ps.downed) io.to(room.code).emit('PLAYER_DOWNED', { playerId: ev.targetId });
    }

    // Emit fire DoT damage events.
    for (const { enemyId, newHp } of res.fireDamagedEnemies) {
      io.to(room.code).emit('ENEMY_DAMAGED', { enemyId, hp: newHp });
    }

    // Emit ENEMY_DIED for any enemies that newly died this tick.
    for (const id of res.newlyDeadEnemyIds) {
      io.to(room.code).emit('ENEMY_DIED', { enemyId: id });
    }

    // Doctrine: score kills and burst kills.
    if (res.newlyDeadEnemyIds.length > 0) {
      for (const id of res.newlyDeadEnemyIds) {
        scoreEnemyKilledByTumor(room, room.lastAttackerByEnemy?.get(id));
      }
      scoreBurstKill(room, res.newlyDeadEnemyIds.length);
      for (const flavor of applyDoctrineThresholds(room)) {
        io.to(room.code).emit('BOARD_DOCTRINE_SHIFT', { flavor });
      }
    }

    if (res.phaseChanged) {
      room.lootPool = generateLootPool([...room.registry.keys()], room.board, room.runId, room.floor);
      io.to(room.code).emit('PHASE_CHANGED', { phase: 'loot', lootPool: room.lootPool });
    }

    if (res.wiped && res.ended) {
      io.to(room.code).emit('RUN_ENDED', res.ended);
    }

    // 5. Broadcast enemy positions for all alive enemies (R8).
    for (const [eid, enemy] of room.enemies) {
      if (enemy.alive) {
        io.to(room.code).emit('ENEMY_MOVED', { enemyId: eid, x: enemy.x, y: enemy.y });
      }
    }

    // 6. Refresh auto-aim targets for players in 'auto' mode. Emit
    //    PLAYER_AIM_CHANGED only when the target changes (delta only, P3, P5).
    for (const [pid, aim] of room.aimStates) {
      if (aim.mode !== 'auto') continue;
      const ps = room.playerStates.get(pid);
      if (!ps || ps.downed) continue;
      const newTarget = selectAutoAimTarget(ps, room.enemies);
      if (newTarget !== aim.targetId) {
        const next = { mode: 'auto' as const, targetId: newTarget };
        room.aimStates.set(pid, next);
        io.to(room.code).emit('PLAYER_AIM_CHANGED', { playerId: pid, mode: 'auto', targetId: newTarget });
      }
    }
  }
}

// Production bootstrap. Imported lazily so tests never open a port.
export async function startServer(port: number): Promise<void> {
  const { Server } = await import('socket.io');
  const io = new Server(port, { cors: { origin: '*' } });
  const manager = new RoomManager();
  // socket.io's Server is structurally richer than SocketIOServerLike; cast at
  // this single boundary so the handler logic stays transport-agnostic.
  const ioLike = io as unknown as SocketIOServerLike;
  registerHandlers(ioLike, manager);
  setInterval(() => runBleedTick(ioLike, manager, BLEED_TICK_INTERVAL_MS / 1000), BLEED_TICK_INTERVAL_MS);
  setInterval(() => runCombatTick(ioLike, manager, COMBAT_TICK_MS / 1000), COMBAT_TICK_MS);
  // eslint-disable-next-line no-console
  console.log(`Veins server listening on :${port}`);
}

const isMain = process.argv[1] !== undefined && process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  void startServer(Number(process.env.PORT) || 3001);
}
