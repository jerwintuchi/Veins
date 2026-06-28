import { describe, it, expect } from 'vitest';
import { runCombatTick, registerHandlers, type ServerSocket, type SocketIOServerLike } from '../index.js';
import { RoomManager } from '../room/manager.js';
import { SHAMBLER_DEF, PLAYER_MAX_HP, PROJECTILE_MAX_RANGE } from '@testament/shared';
import type { EnemyState } from './types.js';
import type { PlayerState } from '@testament/shared';

function makeFakeIo() {
  const roomEmits: Array<{ room: string; event: string; payload: unknown }> = [];
  let connectionHandler: ((socket: ServerSocket) => void) | undefined;
  const io: SocketIOServerLike = {
    on: (_event, listener) => { connectionHandler = listener; },
    to: (room: string) => ({ emit: (event, payload) => roomEmits.push({ room, event, payload }) }),
  };
  return { io, roomEmits, connect: () => connectionHandler };
}

function makeFakeSocket(id: string): ServerSocket & {
  handlers: Map<string, (payload: unknown) => void>;
  emits: Array<{ event: string; payload: unknown }>;
  joined: string[];
} {
  const handlers = new Map<string, (payload: unknown) => void>();
  const emits: Array<{ event: string; payload: unknown }> = [];
  const joined: string[] = [];
  return {
    id, data: {}, handlers, emits, joined,
    on: (e, l) => handlers.set(e, l),
    emit: (e, p) => emits.push({ event: e, payload: p }),
    join: (r) => joined.push(r),
  };
}

// Helper: create + join + start a 2-player room, return { manager, code }.
function startedRoom(code: string, runId = `run-${code}`) {
  const manager = new RoomManager({ generateCode: () => code, generateRunId: () => runId });
  const { room } = manager.createRoom('h1');
  manager.joinRoom(room.code, 'p2');
  manager.startRun(room.code);
  return { manager, code };
}

// Helper: put a room into combat phase (simulating a descend).
function putInCombat(manager: RoomManager, code: string) {
  manager.descendRoom(code);
}

describe('runCombatTick — loot/ended rooms skipped (T14, P7)', () => {
  it('a room in loot phase receives no combat events', () => {
    const { manager, code } = startedRoom('LT1');
    // Manually set to loot phase (run now starts in combat; this tests the skip logic).
    const room = manager.getRoom(code)!;
    room.phase = 'loot';
    room.enemies = new Map();
    const { io, roomEmits } = makeFakeIo();
    runCombatTick(io, manager, 0.1);
    expect(roomEmits).toHaveLength(0);
  });

  it('a room in ended status receives no combat events', () => {
    const { manager, code } = startedRoom('LT2');
    putInCombat(manager, code);
    manager.extractRoom(code); // end the run
    const { io, roomEmits } = makeFakeIo();
    runCombatTick(io, manager, 0.1);
    expect(roomEmits).toHaveLength(0);
  });
});

describe('runCombatTick — PLAYER_DAMAGED + PLAYER_DOWNED (T14, R10)', () => {
  it('emits PLAYER_DAMAGED when an enemy attack lands', () => {
    const { manager, code } = startedRoom('DMG1');
    putInCombat(manager, code);
    const room = manager.getRoom(code)!;

    // Replace enemies with a single shambler right on top of player h1.
    const enemy: EnemyState = {
      id: 'e-test', typeId: 'shambler', x: 0, y: 0,
      hp: SHAMBLER_DEF.baseHp, maxHp: SHAMBLER_DEF.baseHp,
      damage: SHAMBLER_DEF.damage,
      alive: true, attackCooldownRemaining: 0,
    };
    room.enemies = new Map([['e-test', enemy]]);

    // Place h1 within attack range.
    const ps = room.playerStates.get('h1')!;
    room.playerStates.set('h1', { ...ps, x: 20, y: 0 });

    const { io, roomEmits } = makeFakeIo();
    runCombatTick(io, manager, 0.1);

    const damaged = roomEmits.find(e => e.event === 'PLAYER_DAMAGED');
    expect(damaged).toBeDefined();
    expect((damaged!.payload as { playerId: string }).playerId).toBe('h1');
    expect((damaged!.payload as { hp: number }).hp).toBeLessThan(PLAYER_MAX_HP);
  });

  it('emits PLAYER_DOWNED when a player HP reaches 0', () => {
    const { manager, code } = startedRoom('DWN1');
    putInCombat(manager, code);
    const room = manager.getRoom(code)!;

    // Enemy directly on h1 at (0,0) — guaranteed to be the nearest active player.
    const enemy: EnemyState = {
      id: 'e-test', typeId: 'shambler', x: 20, y: 0,
      hp: SHAMBLER_DEF.baseHp, maxHp: SHAMBLER_DEF.baseHp,
      damage: SHAMBLER_DEF.damage,
      alive: true, attackCooldownRemaining: 0,
    };
    room.enemies = new Map([['e-test', enemy]]);
    // h1 at (0,0): within shambler's attack range (40). p2 placed far away
    // so the enemy targets h1. h1 has 1 HP so one attack downs them.
    const h1 = room.playerStates.get('h1')!;
    const p2 = room.playerStates.get('p2')!;
    room.playerStates.set('h1', { ...h1, hp: 1, x: 0, y: 0 });
    room.playerStates.set('p2', { ...p2, x: 9999, y: 9999 }); // outside detection range

    const { io, roomEmits } = makeFakeIo();
    runCombatTick(io, manager, 0.1);

    expect(roomEmits.some(e => e.event === 'PLAYER_DOWNED')).toBe(true);
  });
});

describe('runCombatTick — PHASE_CHANGED on last enemy death (T14, R7)', () => {
  it('emits PHASE_CHANGED with phase:loot when all enemies are pre-killed', () => {
    const { manager, code } = startedRoom('PC1');
    putInCombat(manager, code);
    const room = manager.getRoom(code)!;

    // Kill all enemies (simulates player attacks from the future weapon spec).
    for (const e of room.enemies.values()) e.alive = false;

    const { io, roomEmits } = makeFakeIo();
    runCombatTick(io, manager, 0.1);

    const pc = roomEmits.find(e => e.event === 'PHASE_CHANGED');
    expect(pc).toBeDefined();
    expect((pc!.payload as { phase: string }).phase).toBe('loot');
  });

  it('emits exactly one PHASE_CHANGED per floor-clear tick (delta, not resync, I6)', () => {
    const { manager, code } = startedRoom('PC2');
    putInCombat(manager, code);
    const room = manager.getRoom(code)!;
    for (const e of room.enemies.values()) e.alive = false;

    const { io, roomEmits } = makeFakeIo();
    runCombatTick(io, manager, 0.1);

    const phaseEvents = roomEmits.filter(e => e.event === 'PHASE_CHANGED');
    expect(phaseEvents).toHaveLength(1);
  });
});

describe('runCombatTick — RUN_ENDED on wipe (T14, R6)', () => {
  it('emits RUN_ENDED with outcome:wiped when all players are downed', () => {
    const { manager, code } = startedRoom('WIPE1');
    putInCombat(manager, code);
    const room = manager.getRoom(code)!;

    // Place a shambler ready to attack at h1's position.
    const enemy: EnemyState = {
      id: 'e-wipe', typeId: 'shambler', x: 20, y: 0,
      hp: SHAMBLER_DEF.baseHp, maxHp: SHAMBLER_DEF.baseHp,
      damage: SHAMBLER_DEF.damage,
      alive: true, attackCooldownRemaining: 0,
    };
    room.enemies = new Map([['e-wipe', enemy]]);

    // Set both players to 1 HP and only h1 in attack range; p2 already downed.
    const h1 = room.playerStates.get('h1')!;
    const p2 = room.playerStates.get('p2')!;
    room.playerStates.set('h1', { ...h1, hp: 1, x: 0, y: 0 });
    room.playerStates.set('p2', { ...p2, hp: 0, downed: true });

    const { io, roomEmits } = makeFakeIo();
    runCombatTick(io, manager, 0.1);

    const ended = roomEmits.find(e => e.event === 'RUN_ENDED');
    expect(ended).toBeDefined();
    expect((ended!.payload as { outcome: string }).outcome).toBe('wiped');
  });
});

describe('move-player handler (T4-weapon, R4, P2)', () => {
  it('stores direction and PLAYER_MOVED is emitted on the next combat tick (not immediately)', () => {
    const { io, roomEmits, connect } = makeFakeIo();
    const manager = new RoomManager({ generateCode: () => 'MVP1', generateRunId: () => 'run-mvp1' });
    registerHandlers(io, manager);

    const host = makeFakeSocket('h1');
    connect()!(host);
    host.handlers.get('create-room')!(undefined);
    const p2 = makeFakeSocket('p2');
    connect()!(p2);
    p2.handlers.get('join-room')!({ code: 'MVP1' });
    host.handlers.get('start-run')!(undefined);

    // Put room into combat phase so the tick runs.
    const room = manager.getRoom('MVP1')!;
    room.phase = 'combat';
    // Ensure there's a live enemy so phase doesn't flip back to loot.
    room.enemies.set('e1', { id: 'e1', typeId: 'shambler', x: 9999, y: 9999, hp: 60, maxHp: 60, damage: 15, alive: true, attackCooldownRemaining: 9 });

    roomEmits.length = 0; // clear setup noise
    // move-player should NOT emit PLAYER_MOVED immediately.
    host.handlers.get('move-player')!({ dx: 1, dy: 0 });
    expect(roomEmits.find(e => e.event === 'PLAYER_MOVED')).toBeUndefined();

    // After the combat tick, PLAYER_MOVED is emitted with the updated position.
    runCombatTick(io, manager, 0.1);
    const moved = roomEmits.find(e => e.event === 'PLAYER_MOVED');
    expect(moved).toBeDefined();
    expect((moved!.payload as { playerId: string }).playerId).toBe('h1');
    expect((moved!.payload as { x: number }).x).toBeGreaterThan(0);
  });

  it('emits LOBBY_ERROR for a malformed payload (missing dy)', () => {
    const { io, connect } = makeFakeIo();
    const manager = new RoomManager({ generateCode: () => 'MVP2', generateRunId: () => 'run-mvp2' });
    registerHandlers(io, manager);

    const host = makeFakeSocket('h1');
    connect()!(host);
    host.handlers.get('create-room')!(undefined);
    const p2 = makeFakeSocket('p2');
    connect()!(p2);
    p2.handlers.get('join-room')!({ code: 'MVP2' });
    host.handlers.get('start-run')!(undefined);

    expect(() => host.handlers.get('move-player')!({ dx: 1 })).not.toThrow();
    const err = host.emits.find(e => e.event === 'LOBBY_ERROR');
    expect(err).toBeDefined();
    expect((err!.payload as { code: string }).code).toBe('INVALID_REQUEST');
  });

  it('silently ignores move-player when not in a room (no LOBBY_ERROR — per-frame input)', () => {
    const { io, connect } = makeFakeIo();
    registerHandlers(io, new RoomManager());
    const sock = makeFakeSocket('loner');
    connect()!(sock);
    sock.handlers.get('move-player')!({ dx: 1, dy: 0 });
    expect(sock.emits.find(e => e.event === 'LOBBY_ERROR')).toBeUndefined();
  });
});

describe('revive phase guard (T12, R11, P6)', () => {
  // DECISION_LOG 2026-06-28: revive is allowed in loot (regroup), not just combat.
  it('allows a valid revive during loot phase and brings the teammate back', () => {
    const { io, roomEmits, connect } = makeFakeIo();
    const manager = new RoomManager({ generateCode: () => 'RVP1', generateRunId: () => 'run-rvp1' });
    registerHandlers(io, manager);

    const host = makeFakeSocket('h1');
    connect()!(host);
    host.handlers.get('create-room')!(undefined);
    const p2 = makeFakeSocket('p2');
    connect()!(p2);
    p2.handlers.get('join-room')!({ code: 'RVP1' });
    host.handlers.get('start-run')!(undefined);

    const room = manager.getRoom('RVP1')!;
    room.phase = 'loot';
    room.enemies = new Map();
    // h1 owns a slot holding a relic to sacrifice; p2 owns an empty target slot.
    const relicId = [...room.registry.keys()][0]!;
    const hostSlot = Object.values(room.board.slots).find(s => s.ownerId === 'h1')!;
    room.board.slots[`${hostSlot.coord.q},${hostSlot.coord.r}`] = { ...hostSlot, relicId };
    const p2Slot = Object.values(room.board.slots).find(s => s.ownerId === 'p2' && s.relicId === null)!;
    room.playerStates.set('p2', { ...room.playerStates.get('p2')!, downed: true, hp: 0 });

    host.handlers.get('revive')!({ sourceCoord: hostSlot.coord, targetCoord: p2Slot.coord });

    expect(host.emits.find(e => e.event === 'LINKED_FATES_ERROR')).toBeUndefined();
    expect(roomEmits.find(e => e.event === 'PLAYER_REVIVED')).toBeDefined();
    expect(room.playerStates.get('p2')!.downed).toBe(false);
  });

  it('emits LINKED_FATES_ERROR with WRONG_PHASE when reviving outside combat/loot (transition)', () => {
    const { io, connect } = makeFakeIo();
    const manager = new RoomManager({ generateCode: () => 'RVP3', generateRunId: () => 'run-rvp3' });
    registerHandlers(io, manager);

    const host = makeFakeSocket('h1');
    connect()!(host);
    host.handlers.get('create-room')!(undefined);
    const p2 = makeFakeSocket('p2');
    connect()!(p2);
    p2.handlers.get('join-room')!({ code: 'RVP3' });
    host.handlers.get('start-run')!(undefined);
    const room = manager.getRoom('RVP3')!;
    room.phase = 'transition';

    host.handlers.get('revive')!({ sourceCoord: { q: 0, r: 0 }, targetCoord: { q: 1, r: 0 } });
    // Visible in the revive panel (LINKED_FATES_ERROR), not a swallowed LOBBY_ERROR.
    expect(host.emits.find(e => e.event === 'LOBBY_ERROR')).toBeUndefined();
    const err = host.emits.find(e => e.event === 'LINKED_FATES_ERROR');
    expect(err).toBeDefined();
    expect((err!.payload as { code: string }).code).toBe('WRONG_PHASE');
  });
});

describe('descend phase guard (review #5)', () => {
  it('emits LOBBY_ERROR with WRONG_PHASE when descending from combat phase', () => {
    const { io, roomEmits, connect } = makeFakeIo();
    const manager = new RoomManager({ generateCode: () => 'DPG1', generateRunId: () => 'run-dpg1' });
    registerHandlers(io, manager);

    const host = makeFakeSocket('h1');
    connect()!(host);
    host.handlers.get('create-room')!(undefined);
    const p2 = makeFakeSocket('p2');
    connect()!(p2);
    p2.handlers.get('join-room')!({ code: 'DPG1' });
    host.handlers.get('start-run')!(undefined);
    // Run already starts in combat phase — no need to descend first.
    expect(manager.getRoom('DPG1')?.phase).toBe('combat');

    // Attempting another descend from combat phase must be rejected.
    roomEmits.length = 0;
    host.handlers.get('descend')!(undefined);

    const err = host.emits.find(e => e.event === 'LOBBY_ERROR');
    expect(err).toBeDefined();
    expect((err!.payload as { code: string }).code).toBe('WRONG_PHASE');
    expect(roomEmits.some(e => e.event === 'FLOOR_ADVANCED')).toBe(false);
    expect(manager.getRoom('DPG1')?.floor).toBe(1); // floor not advanced
  });

  it('emits ENEMY_SPAWNED for each enemy after a valid descend (R10)', () => {
    const { io, roomEmits, connect } = makeFakeIo();
    const manager = new RoomManager({ generateCode: () => 'ESP1', generateRunId: () => 'run-esp1' });
    registerHandlers(io, manager);

    const host = makeFakeSocket('h1');
    connect()!(host);
    host.handlers.get('create-room')!(undefined);
    const p2 = makeFakeSocket('p2');
    connect()!(p2);
    p2.handlers.get('join-room')!({ code: 'ESP1' });
    host.handlers.get('start-run')!(undefined);
    // Force loot phase so descend is accepted (run now starts in combat).
    const espRoom = manager.getRoom('ESP1')!;
    espRoom.phase = 'loot';
    espRoom.enemies = new Map();

    roomEmits.length = 0;
    host.handlers.get('descend')!(undefined);

    const spawnEvents = roomEmits.filter(e => e.event === 'ENEMY_SPAWNED');
    const room = manager.getRoom('ESP1')!;
    // One ENEMY_SPAWNED per enemy in room.enemies.
    expect(spawnEvents).toHaveLength(room.enemies.size);
    for (const ev of spawnEvents) {
      const p = ev.payload as { enemyId: string; typeId: string; x: number; y: number; hp: number };
      expect(typeof p.enemyId).toBe('string');
      expect(['shambler', 'spitter']).toContain(p.typeId);
      expect(typeof p.x).toBe('number');
      expect(typeof p.hp).toBe('number');
    }
  });
});

// --- T5: aim-player handler ---

function setupRoom(code: string, runId: string) {
  const { io, roomEmits, connect } = makeFakeIo();
  const manager = new RoomManager({ generateCode: () => code, generateRunId: () => runId });
  registerHandlers(io, manager);
  const host = makeFakeSocket('h1');
  connect()!(host);
  host.handlers.get('create-room')!(undefined);
  const p2 = makeFakeSocket('p2');
  connect()!(p2);
  p2.handlers.get('join-room')!({ code });
  host.handlers.get('start-run')!(undefined);
  return { io, roomEmits, host, p2, manager };
}

describe('aim-player handler (T5, R6, R7)', () => {
  it('zero vector switches player to auto mode and emits PLAYER_AIM_CHANGED', () => {
    const { host, roomEmits } = setupRoom('AIM1', 'run-aim1');
    roomEmits.length = 0;
    // First put into manual so a transition event fires on zero.
    host.handlers.get('aim-player')!({ dx: 1, dy: 0 });
    roomEmits.length = 0;
    host.handlers.get('aim-player')!({ dx: 0, dy: 0 });
    const ev = roomEmits.find(e => e.event === 'PLAYER_AIM_CHANGED');
    expect(ev).toBeDefined();
    expect((ev!.payload as { mode: string }).mode).toBe('auto');
  });

  it('non-zero vector switches player to manual mode and emits PLAYER_AIM_CHANGED', () => {
    const { host, roomEmits } = setupRoom('AIM2', 'run-aim2');
    roomEmits.length = 0;
    host.handlers.get('aim-player')!({ dx: 3, dy: 4 }); // magnitude 5 → normalized (0.6, 0.8)
    const ev = roomEmits.find(e => e.event === 'PLAYER_AIM_CHANGED');
    expect(ev).toBeDefined();
    const p = ev!.payload as { mode: string; dx: number; dy: number };
    expect(p.mode).toBe('manual');
    expect(p.dx).toBeCloseTo(0.6);
    expect(p.dy).toBeCloseTo(0.8);
  });

  it('emits LOBBY_ERROR for a malformed payload (missing dy)', () => {
    const { host } = setupRoom('AIM3', 'run-aim3');
    host.handlers.get('aim-player')!({ dx: 1 });
    const err = host.emits.find(e => e.event === 'LOBBY_ERROR');
    expect(err).toBeDefined();
    expect((err!.payload as { code: string }).code).toBe('INVALID_REQUEST');
  });

  it('silently ignores aim-player when not in a room (no LOBBY_ERROR — per-frame input)', () => {
    const { io, connect } = makeFakeIo();
    registerHandlers(io, new RoomManager());
    const sock = makeFakeSocket('loner');
    connect()!(sock);
    sock.handlers.get('aim-player')!({ dx: 1, dy: 0 });
    expect(sock.emits.find(e => e.event === 'LOBBY_ERROR')).toBeUndefined();
  });

  it('does not re-emit PLAYER_AIM_CHANGED when aim state is unchanged (manual)', () => {
    const { host, roomEmits } = setupRoom('AIM4', 'run-aim4');
    host.handlers.get('aim-player')!({ dx: 1, dy: 0 });
    roomEmits.length = 0;
    host.handlers.get('aim-player')!({ dx: 1, dy: 0 }); // same normalized value
    const evs = roomEmits.filter(e => e.event === 'PLAYER_AIM_CHANGED');
    expect(evs).toHaveLength(0);
  });
});

// --- Hold-to-fire intent (desktop) ---

describe('set-firing handler', () => {
  it('sets the player firing flag false (opt out) then true (held)', () => {
    const { host, manager } = setupRoom('FIRE1', 'run-fire1');
    const room = manager.getRoom('FIRE1')!;
    host.handlers.get('set-firing')!({ firing: false });
    expect(room.playerFiring!.get('h1')).toBe(false);
    host.handlers.get('set-firing')!({ firing: true });
    expect(room.playerFiring!.get('h1')).toBe(true);
  });

  it('ignores a malformed payload (no throw, flag unchanged)', () => {
    const { host, manager } = setupRoom('FIRE2', 'run-fire2');
    const room = manager.getRoom('FIRE2')!;
    host.handlers.get('set-firing')!({ firing: false });
    host.handlers.get('set-firing')!({ firing: 'yes' }); // malformed
    expect(room.playerFiring!.get('h1')).toBe(false); // unchanged
  });

  it('silently ignores set-firing when not in a room', () => {
    const { io, connect } = makeFakeIo();
    registerHandlers(io, new RoomManager());
    const sock = makeFakeSocket('loner');
    connect()!(sock);
    sock.handlers.get('set-firing')!({ firing: true });
    expect(sock.emits.find(e => e.event === 'LOBBY_ERROR')).toBeUndefined();
  });
});

// --- T6: auto-aim refresh in combat tick ---

describe('auto-aim refresh in runCombatTick (T6, R8)', () => {
  it('emits PLAYER_AIM_CHANGED when a new auto-aim target enters range during combat', () => {
    const { io, roomEmits, manager } = setupRoom('AAR1', 'run-aar1');
    const room = manager.getRoom('AAR1')!;
    room.phase = 'combat';
    room.enemies.clear();
    room.enemies.set('e1', {
      id: 'e1', typeId: 'shambler', x: 50, y: 0,
      hp: 60, maxHp: 60, damage: 15, alive: true, attackCooldownRemaining: 999,
    });
    const ps = room.playerStates.get('h1')!;
    room.playerStates.set('h1', { ...ps, x: 0, y: 0, downed: false });
    room.aimStates.set('h1', { mode: 'auto', targetId: null });
    roomEmits.length = 0;
    runCombatTick(io, manager, 0.1);
    const ev = roomEmits.find(e => e.event === 'PLAYER_AIM_CHANGED');
    expect(ev).toBeDefined();
    const p = ev!.payload as { playerId: string; mode: string; targetId: string };
    expect(p.playerId).toBe('h1');
    expect(p.mode).toBe('auto');
    expect(p.targetId).toBe('e1');
  });

  it('does not emit PLAYER_AIM_CHANGED for a player in manual mode', () => {
    const { io, roomEmits, manager } = setupRoom('AAR2', 'run-aar2');
    const room = manager.getRoom('AAR2')!;
    room.phase = 'combat';
    room.enemies.clear();
    room.enemies.set('e1', {
      id: 'e1', typeId: 'shambler', x: 50, y: 0,
      hp: 60, maxHp: 60, damage: 15, alive: true, attackCooldownRemaining: 999,
    });
    // Put all players in manual mode so no auto-aim events fire.
    for (const pid of room.players) room.aimStates.set(pid, { mode: 'manual', dx: 1, dy: 0 });
    roomEmits.length = 0;
    runCombatTick(io, manager, 0.1);
    const evs = roomEmits.filter(e => e.event === 'PLAYER_AIM_CHANGED');
    expect(evs).toHaveLength(0);
  });

  it('does not emit PLAYER_AIM_CHANGED for a downed player', () => {
    const { io, roomEmits, manager } = setupRoom('AAR3', 'run-aar3');
    const room = manager.getRoom('AAR3')!;
    room.phase = 'combat';
    room.enemies.clear();
    room.enemies.set('e1', {
      id: 'e1', typeId: 'shambler', x: 50, y: 0,
      hp: 60, maxHp: 60, damage: 15, alive: true, attackCooldownRemaining: 999,
    });
    // Move p2 far from the enemy so it doesn't get an auto-aim event.
    const ps2 = room.playerStates.get('p2')!;
    room.playerStates.set('p2', { ...ps2, x: 99999, y: 99999 });
    const ps = room.playerStates.get('h1')!;
    room.playerStates.set('h1', { ...ps, x: 0, y: 0, downed: true });
    room.aimStates.set('h1', { mode: 'auto', targetId: null });
    room.aimStates.set('p2', { mode: 'auto', targetId: null });
    roomEmits.length = 0;
    runCombatTick(io, manager, 0.1);
    // Only h1 is near the enemy but downed — no PLAYER_AIM_CHANGED for h1.
    const evs = roomEmits.filter(e => e.event === 'PLAYER_AIM_CHANGED' &&
      (e.payload as { playerId: string }).playerId === 'h1');
    expect(evs).toHaveLength(0);
  });
});

// ─── Weapon tick integration (T5, R5–R8) ──────────────────────────────────

function setupWeaponRoom(code: string, runId = `run-${code}`) {
  const manager = new RoomManager({ generateCode: () => code, generateRunId: () => runId });
  const { room } = manager.createRoom('h1');
  manager.joinRoom(room.code, 'p2');
  manager.startRun(room.code);
  const r = manager.getRoom(code)!;
  r.phase = 'combat';
  // Replace with a flat dungeon so test positions at (0,0), (5,0), (100,0) etc.
  // are all walkable and projectile wall-termination doesn't interfere.
  r.dungeon = { runId, width: 9999, height: 9999, corridors: [],
    rooms: [{ id: 'room-0', rect: { x: 0, y: 0, width: 9999, height: 9999 } }] };
  // Place p2 far away to avoid interference from p2's auto-fire.
  const ps2 = r.playerStates.get('p2')!;
  r.playerStates.set('p2', { ...ps2, x: 99999, y: 99999 });
  r.aimStates.set('p2', { mode: 'manual', dx: 1, dy: 0 }); // manual so p2 fires in known direction
  return { manager, code, room: r };
}

describe('weapon auto-fire integration (T5, R5, R7)', () => {
  it('emits PROJECTILE_FIRED when a player in auto mode has a target and cooldown=0', () => {
    const { manager, code, room } = setupWeaponRoom('WF1');
    const { io, roomEmits } = makeFakeIo();
    // Fix h1 at a known position, then place enemy 100 units to the right.
    const ps = room.playerStates.get('h1')!;
    room.playerStates.set('h1', { ...ps, x: 0, y: 0 });
    room.enemies.set('e1', { id: 'e1', typeId: 'shambler', x: 100, y: 0, hp: 60, maxHp: 60, damage: 15, alive: true, attackCooldownRemaining: 999 });
    room.aimStates.set('h1', { mode: 'auto', targetId: 'e1' });
    room.weaponCooldowns.set('h1', 0);
    runCombatTick(io, manager, 0.1);
    const fired = roomEmits.filter(e => e.event === 'PROJECTILE_FIRED' && (e.payload as { playerId: string }).playerId === 'h1');
    expect(fired).toHaveLength(1);
    const p = fired[0]!.payload as { dx: number; dy: number; x: number; y: number };
    expect(p.dx).toBeCloseTo(1);  // enemy is to the right
    expect(p.dy).toBeCloseTo(0);
  });

  it('emits ENEMY_DAMAGED and PROJECTILE_REMOVED (hit) when projectile reaches enemy', () => {
    const { manager, code, room } = setupWeaponRoom('WF2');
    const { io, roomEmits } = makeFakeIo();
    // Place a projectile already adjacent to the enemy.
    room.enemies.set('e1', { id: 'e1', typeId: 'shambler', x: 5, y: 0, hp: 60, maxHp: 60, damage: 15, alive: true, attackCooldownRemaining: 999 });
    room.projectiles.set('p0', { id: 'p0', ownerId: 'h1', x: 0, y: 0, dx: 1, dy: 0, distanceTravelled: 0 });
    runCombatTick(io, manager, 0);
    expect(roomEmits.some(e => e.event === 'ENEMY_DAMAGED')).toBe(true);
    expect(roomEmits.some(e => e.event === 'PROJECTILE_REMOVED' && (e.payload as { reason: string }).reason === 'hit')).toBe(true);
  });

  it('removes a killed enemy from room.enemies after ENEMY_DIED is emitted (corpses not retained)', () => {
    const { manager, code, room } = setupWeaponRoom('WF2b');
    const { io, roomEmits } = makeFakeIo();
    // 1-hp enemy + adjacent projectile → dies this tick.
    room.enemies.set('e1', { id: 'e1', typeId: 'shambler', x: 5, y: 0, hp: 1, maxHp: 60, damage: 15, alive: true, attackCooldownRemaining: 999 });
    room.projectiles.set('p0', { id: 'p0', ownerId: 'h1', x: 0, y: 0, dx: 1, dy: 0, distanceTravelled: 0 });
    runCombatTick(io, manager, 0);
    expect(roomEmits.some(e => e.event === 'ENEMY_DIED' && (e.payload as { enemyId: string }).enemyId === 'e1')).toBe(true);
    // The corpse must not linger in room state (perf + no invisible-body separation).
    expect(room.enemies.has('e1')).toBe(false);
  });

  it('emits PROJECTILE_REMOVED (range) when projectile exceeds MAX_RANGE', () => {
    const { manager, code, room } = setupWeaponRoom('WF3');
    const { io, roomEmits } = makeFakeIo();
    room.projectiles.set('p0', { id: 'p0', ownerId: 'h1', x: 0, y: 0, dx: 1, dy: 0, distanceTravelled: PROJECTILE_MAX_RANGE + 1 });
    runCombatTick(io, manager, 0);
    expect(roomEmits.some(e => e.event === 'PROJECTILE_REMOVED' && (e.payload as { reason: string }).reason === 'range')).toBe(true);
    expect(roomEmits.some(e => e.event === 'ENEMY_DAMAGED')).toBe(false);
  });

  it('emits ENEMY_MOVED for alive enemies after each tick', () => {
    const { manager, code, room } = setupWeaponRoom('WF4');
    const { io, roomEmits } = makeFakeIo();
    room.enemies.set('e1', { id: 'e1', typeId: 'shambler', x: 9999, y: 9999, hp: 60, maxHp: 60, damage: 15, alive: true, attackCooldownRemaining: 999 });
    runCombatTick(io, manager, 0.1);
    const moved = roomEmits.filter(e => e.event === 'ENEMY_MOVED');
    expect(moved.some(e => (e.payload as { enemyId: string }).enemyId === 'e1')).toBe(true);
  });

  it('does not emit ENEMY_MOVED for dead enemies', () => {
    const { manager, code, room } = setupWeaponRoom('WF5');
    const { io, roomEmits } = makeFakeIo();
    room.enemies.set('e1', { id: 'e1', typeId: 'shambler', x: 0, y: 0, hp: 0, maxHp: 60, damage: 15, alive: false, attackCooldownRemaining: 0 });
    runCombatTick(io, manager, 0.1);
    const moved = roomEmits.filter(e => e.event === 'ENEMY_MOVED' && (e.payload as { enemyId: string }).enemyId === 'e1');
    expect(moved).toHaveLength(0);
  });
});
