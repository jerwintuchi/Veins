import { describe, it, expect, afterEach } from 'vitest';
import { generateDungeon } from '../dungeon/bsp.js';
import { RoomManager } from './manager.js';

// Deterministic code generator for tests: sequential codes.
function seqCodes() {
  let n = 0;
  return () => `CODE${n++}`;
}

describe('RoomManager.createRoom', () => {
  it('creates a lobby room with the host as the sole player', () => {
    const mgr = new RoomManager({ generateCode: seqCodes() });
    const res = mgr.createRoom('host1');
    expect(res.ok).toBe(true);
    expect(res.room.status).toBe('lobby');
    expect(res.room.hostId).toBe('host1');
    expect(res.room.players).toEqual(['host1']);
  });

  it('issues unique codes even when the generator collides', () => {
    // Generator returns the same code twice, then a fresh one.
    const codes = ['DUP', 'DUP', 'FRESH'];
    let i = 0;
    const mgr = new RoomManager({ generateCode: () => codes[i++] ?? 'X' });
    const a = mgr.createRoom('h1');
    const b = mgr.createRoom('h2');
    expect(a.room.code).toBe('DUP');
    expect(b.room.code).toBe('FRESH');
  });
});

describe('RoomManager.joinRoom', () => {
  it('adds a player to a lobby room', () => {
    const mgr = new RoomManager({ generateCode: seqCodes() });
    const { room } = mgr.createRoom('h1');
    const res = mgr.joinRoom(room.code, 'p2');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.room.players).toEqual(['h1', 'p2']);
  });

  it('rejects ROOM_NOT_FOUND for an unknown code', () => {
    const mgr = new RoomManager({ generateCode: seqCodes() });
    const res = mgr.joinRoom('NOPE', 'p1');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('ROOM_NOT_FOUND');
  });

  it('rejects ROOM_FULL beyond 4 players', () => {
    const mgr = new RoomManager({ generateCode: seqCodes() });
    const { room } = mgr.createRoom('h1');
    mgr.joinRoom(room.code, 'p2');
    mgr.joinRoom(room.code, 'p3');
    mgr.joinRoom(room.code, 'p4');
    const res = mgr.joinRoom(room.code, 'p5');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('ROOM_FULL');
  });

  it('rejects ALREADY_IN_ROOM for a duplicate player', () => {
    const mgr = new RoomManager({ generateCode: seqCodes() });
    const { room } = mgr.createRoom('h1');
    const res = mgr.joinRoom(room.code, 'h1');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('ALREADY_IN_ROOM');
  });

  it('rejects ALREADY_STARTED once the run is in progress', () => {
    const mgr = new RoomManager({ generateCode: seqCodes() });
    const { room } = mgr.createRoom('h1');
    mgr.joinRoom(room.code, 'p2');
    mgr.startRun(room.code);
    const res = mgr.joinRoom(room.code, 'p3');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('ALREADY_STARTED');
  });
});

describe('RoomManager.leaveRoom', () => {
  it('removes a player from the room', () => {
    const mgr = new RoomManager({ generateCode: seqCodes() });
    const { room } = mgr.createRoom('h1');
    mgr.joinRoom(room.code, 'p2');
    const res = mgr.leaveRoom(room.code, 'p2');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.deleted).toBe(false);
    expect(res.room?.players).toEqual(['h1']);
  });

  it('deletes the room when the last player leaves', () => {
    const mgr = new RoomManager({ generateCode: seqCodes() });
    const { room } = mgr.createRoom('h1');
    const res = mgr.leaveRoom(room.code, 'h1');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.deleted).toBe(true);
    expect(mgr.getRoom(room.code)).toBeUndefined();
  });

  it('reassigns the host when the host leaves', () => {
    const mgr = new RoomManager({ generateCode: seqCodes() });
    const { room } = mgr.createRoom('h1');
    mgr.joinRoom(room.code, 'p2');
    const res = mgr.leaveRoom(room.code, 'h1');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.room?.hostId).toBe('p2');
  });

  it('rejects NOT_IN_ROOM when the player is not present', () => {
    const mgr = new RoomManager({ generateCode: seqCodes() });
    const { room } = mgr.createRoom('h1');
    const res = mgr.leaveRoom(room.code, 'ghost');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('NOT_IN_ROOM');
  });
});

describe('RoomManager.startRun', () => {
  // R1 (solo-play): a lone host can start a run; the board is fully owned by them.
  it('starts a solo run with a single player and a fully-owned board', () => {
    const mgr = new RoomManager({ generateCode: seqCodes(), generateRunId: () => 'solo-run' });
    const { room } = mgr.createRoom('h1');
    const res = mgr.startRun(room.code);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.room.status).toBe('in-progress');
    const slots = Object.values(res.room.board.slots);
    expect(slots).toHaveLength(19);
    for (const slot of slots) expect(slot.ownerId).toBe('h1');
  });

  it('starts the run: in-progress status, generated dungeon, fully-owned board', () => {
    const mgr = new RoomManager({ generateCode: seqCodes(), generateRunId: () => 'fixed-run' });
    const { room } = mgr.createRoom('h1');
    mgr.joinRoom(room.code, 'p2');
    const res = mgr.startRun(room.code);

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.room.status).toBe('in-progress');
    expect(res.room.floor).toBe(1);
    expect(res.room.runId).toBe('fixed-run');

    const slots = Object.values(res.room.board.slots);
    expect(slots).toHaveLength(19);
    for (const slot of slots) {
      expect(['h1', 'p2']).toContain(slot.ownerId);
      expect(slot.relicId).toBe(null);
    }
  });

  it('generates a dungeon deterministic from the run ID', () => {
    const mgr = new RoomManager({ generateCode: seqCodes(), generateRunId: () => 'fixed-run' });
    const { room } = mgr.createRoom('h1');
    mgr.joinRoom(room.code, 'p2');
    const res = mgr.startRun(room.code);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.dungeon).toEqual(generateDungeon('fixed-run'));
  });
});

describe('RoomManager — Bleed Clock integration', () => {
  function startedRoom(mgr: RoomManager) {
    const { room } = mgr.createRoom('h1');
    mgr.joinRoom(room.code, 'p2');
    mgr.startRun(room.code);
    return room.code;
  }

  it('activeRooms returns only in-progress rooms', () => {
    const mgr = new RoomManager({ generateCode: seqCodes() });
    const lobbyOnly = mgr.createRoom('h1'); // stays in lobby
    const code = startedRoom(mgr);

    const active = mgr.activeRooms();
    expect(active.map(r => r.code)).toContain(code);
    expect(active.map(r => r.code)).not.toContain(lobbyOnly.room.code);
  });

  it('tickRoom drains the clock and ends the run on depletion', () => {
    const mgr = new RoomManager({ generateCode: seqCodes() });
    const code = startedRoom(mgr);
    const room = mgr.getRoom(code)!;

    const before = room.bleedClock.current;
    const res = mgr.tickRoom(code, 1);
    expect(res).toBeDefined();
    expect(room.bleedClock.current).toBeLessThan(before);

    // Drain it to zero and confirm the run ends as wiped.
    room.bleedClock.current = room.bleedClock.drainPerSecond; // one tick from empty
    const end = mgr.tickRoom(code, 1);
    expect(end?.ended?.outcome).toBe('wiped');
    expect(room.status).toBe('ended');
  });

  it('tickRoom returns undefined for an unknown room', () => {
    const mgr = new RoomManager({ generateCode: seqCodes() });
    expect(mgr.tickRoom('NOPE', 1)).toBeUndefined();
  });

  it('extractRoom ends an in-progress run as extracted', () => {
    const mgr = new RoomManager({ generateCode: seqCodes() });
    const code = startedRoom(mgr);
    const res = mgr.extractRoom(code);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.ended.outcome).toBe('extracted');
    expect(mgr.getRoom(code)?.status).toBe('ended');
  });

  it('extractRoom rejects a lobby (not in-progress) room', () => {
    const mgr = new RoomManager({ generateCode: seqCodes() });
    const { room } = mgr.createRoom('h1');
    expect(mgr.extractRoom(room.code).ok).toBe(false);
  });

  it('descendRoom advances an in-progress run to the next floor', () => {
    const mgr = new RoomManager({ generateCode: seqCodes() });
    const code = startedRoom(mgr);
    const res = mgr.descendRoom(code);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.event.floor).toBe(2);
    expect(mgr.getRoom(code)?.floor).toBe(2);
  });

  it('descendRoom rejects an unknown code', () => {
    const mgr = new RoomManager({ generateCode: seqCodes() });
    expect(mgr.descendRoom('NOPE').ok).toBe(false);
  });

  // T11 — R3: spawnEnemies wired into descendRoom
  it('descendRoom populates room.enemies with at least one enemy (T11, R3)', () => {
    const mgr = new RoomManager({ generateCode: seqCodes(), generateRunId: () => 'run-t11' });
    const code = startedRoom(mgr);
    mgr.descendRoom(code);
    const room = mgr.getRoom(code)!;
    expect(room.enemies.size).toBeGreaterThan(0);
  });

  it('descendRoom enemy map matches a direct spawnEnemies call with same inputs (T11, P1)', async () => {
    const { spawnEnemies } = await import('../combat/spawn.js');
    const runId = 'run-spawn-match';
    const mgr = new RoomManager({ generateCode: seqCodes(), generateRunId: () => runId });
    const code = startedRoom(mgr);
    mgr.descendRoom(code);
    const room = mgr.getRoom(code)!;
    // Room is now on floor 2; dungeon was generated by descendFloor.
    const expected = spawnEnemies(runId, room.floor, room.dungeon!);
    expect(JSON.stringify([...room.enemies])).toBe(JSON.stringify([...expected]));
  });

  // T11 — R2: startRun initializes playerStates
  it('all players have a playerState with hp===PLAYER_MAX_HP and downed===false after startRun (T11, R2)', async () => {
    const { PLAYER_MAX_HP } = await import('@testament/shared');
    const mgr = new RoomManager({ generateCode: seqCodes(), generateRunId: () => 'run-ps' });
    const { room } = mgr.createRoom('h1');
    mgr.joinRoom(room.code, 'p2');
    mgr.startRun(room.code);
    const r = mgr.getRoom(room.code)!;
    expect(r.playerStates.size).toBe(r.players.length);
    for (const ps of r.playerStates.values()) {
      expect(ps.hp).toBe(PLAYER_MAX_HP);
      expect(ps.maxHp).toBe(PLAYER_MAX_HP);
      expect(ps.downed).toBe(false);
    }
  });

  // T3 — R4: startRun initializes aimStates
  it('all players have aimState mode:auto and targetId:null after startRun (T3, R4)', () => {
    const mgr = new RoomManager({ generateCode: seqCodes(), generateRunId: () => 'run-aim' });
    const { room } = mgr.createRoom('h1');
    mgr.joinRoom(room.code, 'p2');
    mgr.startRun(room.code);
    const r = mgr.getRoom(room.code)!;
    expect(r.aimStates.size).toBe(r.players.length);
    for (const [, aim] of r.aimStates) {
      expect(aim.mode).toBe('auto');
      if (aim.mode === 'auto') expect(aim.targetId).toBeNull();
    }
  });

  // T2 (weapon spec) — R3: startRun initializes weapon state
  it('weaponCooldowns has one entry per player, all 0, after startRun (T2-weapon, R3)', () => {
    const mgr = new RoomManager({ generateCode: seqCodes(), generateRunId: () => 'run-wep' });
    const { room } = mgr.createRoom('h1');
    mgr.joinRoom(room.code, 'p2');
    mgr.startRun(room.code);
    const r = mgr.getRoom(room.code)!;
    expect(r.weaponCooldowns.size).toBe(r.players.length);
    for (const cd of r.weaponCooldowns.values()) expect(cd).toBe(0);
  });

  it('playerMoveInputs has dx:0 dy:0 per player after startRun (T2-weapon, R3)', () => {
    const mgr = new RoomManager({ generateCode: seqCodes(), generateRunId: () => 'run-wep2' });
    const { room } = mgr.createRoom('h1');
    mgr.joinRoom(room.code, 'p2');
    mgr.startRun(room.code);
    const r = mgr.getRoom(room.code)!;
    expect(r.playerMoveInputs.size).toBe(r.players.length);
    for (const input of r.playerMoveInputs.values()) {
      expect(input.dx).toBe(0);
      expect(input.dy).toBe(0);
    }
  });

  it('projectiles is empty and nextProjectileId is 0 after startRun (T2-weapon, R3)', () => {
    const mgr = new RoomManager({ generateCode: seqCodes(), generateRunId: () => 'run-wep3' });
    const { room } = mgr.createRoom('h1');
    mgr.joinRoom(room.code, 'p2');
    mgr.startRun(room.code);
    const r = mgr.getRoom(room.code)!;
    expect(r.projectiles.size).toBe(0);
    expect(r.nextProjectileId).toBe(0);
  });

  // T2 (board-ui spec) — R2: startRun populates registry with STARTER_RELICS
  it('registry contains all STARTER_RELICS after startRun (T2-board-ui, R2)', async () => {
    const { STARTER_RELICS } = await import('@testament/shared');
    const mgr = new RoomManager({ generateCode: seqCodes() });
    const { room } = mgr.createRoom('h1');
    mgr.joinRoom(room.code, 'p2');
    mgr.startRun(room.code);
    const r = mgr.getRoom(room.code)!;
    expect(r.registry.size).toBe(STARTER_RELICS.length);
    for (const relic of STARTER_RELICS) {
      const stored = r.registry.get(relic.id);
      expect(stored).toBeDefined();
      expect(stored?.name).toBe(relic.name);
      expect(stored?.tags).toEqual(relic.tags);
    }
  });

  // T2 (relic-effects spec) — R7: createRoom initialises fireDurations to empty Map
  it('fireDurations is an empty Map immediately after createRoom (T2-relic, R7)', () => {
    const mgr = new RoomManager({ generateCode: seqCodes() });
    const { room } = mgr.createRoom('h1');
    expect(room.fireDurations.size).toBe(0);
  });

  // T2 (relic-effects spec) — R7: startRun initialises combatRng
  it('combatRng is set after startRun (T2-relic, R7)', () => {
    const mgr = new RoomManager({ generateCode: seqCodes(), generateRunId: () => 'run-fx' });
    const { room } = mgr.createRoom('h1');
    mgr.joinRoom(room.code, 'p2');
    mgr.startRun(room.code);
    const r = mgr.getRoom(room.code)!;
    expect(typeof r.combatRng.float).toBe('function');
  });

  // T2 (relic-effects spec) — R7: descendRoom resets fireDurations
  it('descendRoom resets fireDurations to empty Map (T2-relic, R7)', () => {
    const mgr = new RoomManager({ generateCode: seqCodes(), generateRunId: () => 'run-fx2' });
    const { room } = mgr.createRoom('h1');
    mgr.joinRoom(room.code, 'p2');
    mgr.startRun(room.code);
    const r = mgr.getRoom(room.code)!;
    // Simulate a fire status existing.
    r.fireDurations.set('enemy-1', 2.5);
    mgr.descendRoom(r.code);
    expect(r.fireDurations.size).toBe(0);
  });

  // T2 (loot spec) — R2: createRoom initialises lootPools to {}
  it('lootPools is {} immediately after createRoom (T2-loot, R2)', () => {
    const mgr = new RoomManager({ generateCode: seqCodes() });
    const { room } = mgr.createRoom('h1');
    expect(room.lootPools).toEqual({});
  });

  // T2 (loot spec) — R2: startRun begins in combat phase; lootPools are empty at start
  // and get populated per-player when all enemies die (phaseChanged → PHASE_CHANGED event).
  it('lootPools are empty at startRun (combat-first flow) (T2-loot, R2)', async () => {
    const mgr = new RoomManager({ generateCode: seqCodes(), generateRunId: () => 'run-loot' });
    const { room } = mgr.createRoom('h1');
    mgr.joinRoom(room.code, 'p2');
    mgr.startRun(room.code);
    const r = mgr.getRoom(room.code)!;
    expect(r.phase).toBe('combat');
    expect(r.lootPools).toEqual({});
  });
});

describe('test arena env toggle (VEINS_TEST_ARENA)', () => {
  afterEach(() => { delete process.env['VEINS_TEST_ARENA']; });

  it('OFF by default: startRun builds a normal multi-room dungeon (production unaffected)', () => {
    delete process.env['VEINS_TEST_ARENA'];
    const mgr = new RoomManager({ generateCode: seqCodes(), generateRunId: () => 'run-real' });
    const { room } = mgr.createRoom('h1');
    mgr.joinRoom(room.code, 'p2');
    const res = mgr.startRun(room.code);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // A standard BSP dungeon has multiple rooms; the arena has exactly one.
    expect(res.dungeon.rooms.length).toBeGreaterThan(1);
  });

  it('ON: startRun builds a single-room arena with one enemy per type', () => {
    process.env['VEINS_TEST_ARENA'] = '1';
    const mgr = new RoomManager({ generateCode: seqCodes(), generateRunId: () => 'run-arena' });
    const { room } = mgr.createRoom('h1');
    mgr.joinRoom(room.code, 'p2');
    const res = mgr.startRun(room.code);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.dungeon.rooms).toHaveLength(1);
    expect(res.dungeon.corridors).toHaveLength(0);
    const r = mgr.getRoom(room.code)!;
    const types = [...r.enemies.values()].map(e => e.typeId).sort();
    expect(types).toEqual(['shambler', 'spitter']);
  });

  it('ON: descend keeps the arena (single room, one enemy per type)', () => {
    process.env['VEINS_TEST_ARENA'] = '1';
    const mgr = new RoomManager({ generateCode: seqCodes(), generateRunId: () => 'run-arena2' });
    const { room } = mgr.createRoom('h1');
    mgr.startRun(room.code);
    const advanced = mgr.descendRoom(room.code);
    expect(advanced.ok).toBe(true);
    if (!advanced.ok) return;
    expect(advanced.event.dungeon.rooms).toHaveLength(1);
    const r = mgr.getRoom(room.code)!;
    expect([...r.enemies.values()].map(e => e.typeId).sort()).toEqual(['shambler', 'spitter']);
  });
});

describe('descend repositions players to the new floor entry (regression)', () => {
  afterEach(() => { delete process.env['VEINS_TEST_ARENA']; });

  it('moves every player to the new floor entry-room centre, carrying HP', () => {
    const mgr = new RoomManager({ generateCode: seqCodes(), generateRunId: () => 'run-pos' });
    const { room } = mgr.createRoom('h1');
    mgr.joinRoom(room.code, 'p2');
    mgr.startRun(room.code);
    const r = mgr.getRoom(room.code)!;
    // Simulate players having wandered off and taken damage on floor 1.
    for (const [id, ps] of r.playerStates) r.playerStates.set(id, { ...ps, x: 9999, y: 9999, hp: 40 });

    const advanced = mgr.descendRoom(room.code);
    expect(advanced.ok).toBe(true);
    if (!advanced.ok) return;

    const entry = r.dungeon!.rooms[0]!.rect;
    const ex = entry.x + entry.width / 2;
    const ey = entry.y + entry.height / 2;
    for (const ps of r.playerStates.values()) {
      expect(ps.x).toBe(ex);
      expect(ps.y).toBe(ey);
      expect(ps.hp).toBe(40); // HP carries over; only position is reset
    }
    // The new positions ride the FLOOR_ADVANCED payload so the client can snap.
    expect(advanced.event.playerPositions!['h1']).toEqual({ x: ex, y: ey });
    expect(advanced.event.playerPositions!['p2']).toEqual({ x: ex, y: ey });
  });

  it('in the arena, players land at the arena centre, away from the enemy spawns', () => {
    process.env['VEINS_TEST_ARENA'] = '1';
    const mgr = new RoomManager({ generateCode: seqCodes(), generateRunId: () => 'run-pos2' });
    const { room } = mgr.createRoom('h1');
    mgr.startRun(room.code);
    const r = mgr.getRoom(room.code)!;
    const advanced = mgr.descendRoom(room.code);
    expect(advanced.ok).toBe(true);
    if (!advanced.ok) return;

    const entry = advanced.event.dungeon.rooms[0]!.rect;
    const cx = entry.x + entry.width / 2;
    const cy = entry.y + entry.height / 2;
    const player = r.playerStates.get('h1')!;
    expect(player.x).toBe(cx);
    expect(player.y).toBe(cy);
    // Every enemy is comfortably clear of the player's landing spot.
    for (const e of r.enemies.values()) {
      const dist = Math.hypot(e.x - cx, e.y - cy);
      expect(dist).toBeGreaterThan(150); // beyond the spitter's attack range
    }
  });
});
