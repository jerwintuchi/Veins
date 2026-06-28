// @vitest-environment node
// GameScene tests use a lightweight fake Phaser surface — no DOM/WebGL needed.
// We test the scene's logic methods (drawDungeon, spawnEnemy, etc.) directly
// without instantiating a real Phaser.Game.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Phaser stub ---
// All mutating methods return 'self' so method chains don't break.
function makeArc() {
  const self: Record<string, unknown> & { x: number; y: number; fillColor: number } = { x: 0, y: 0, fillColor: 0 };
  self.setPosition  = vi.fn((_x: number, _y: number) => { self.x = _x; self.y = _y; return self; });
  self.setFillStyle = vi.fn((color: number) => { self.fillColor = color; return self; });
  self.setDepth     = vi.fn(() => self);
  self.destroy      = vi.fn();
  return self;
}
function makeRect() {
  const self: Record<string, unknown> & { x: number; y: number } = { x: 0, y: 0 };
  self.setPosition = vi.fn((_x: number, _y: number) => { self.x = _x; self.y = _y; return self; });
  self.setDepth    = vi.fn(() => self);
  self.setOrigin   = vi.fn(() => self);
  self.setX        = vi.fn((_x: number) => { self.x = _x; return self; });
  self.setScale    = vi.fn(() => self);
  self.destroy     = vi.fn();
  return self;
}
function makeGraphics() {
  const self: Record<string, unknown> & { visible: boolean; x: number; y: number } = {
    visible: false, x: 0, y: 0,
  };
  self.clear          = vi.fn(() => self);
  self.fillStyle      = vi.fn(() => self);
  self.fillRect       = vi.fn(() => self);
  self.lineStyle      = vi.fn(() => self);
  self.strokeLineShape = vi.fn(() => self);
  self.strokeCircle   = vi.fn(() => self);
  self.setDepth       = vi.fn(() => self);
  self.setVisible     = vi.fn((_v: boolean) => { self.visible = _v; return self; });
  self.setPosition    = vi.fn((_x: number, _y: number) => { self.x = _x; self.y = _y; return self; });
  return self;
}

vi.mock('phaser', () => {
  class FakeLine {}
  const Geom = { Line: FakeLine };
  const Scenes = { Events: { READY: 'ready' } };
  const Scale = { RESIZE: 'RESIZE', CENTER_BOTH: 'CENTER_BOTH' };
  const AUTO = 'AUTO';
  class FakeScene {
    protected game = {
      registry: {
        get: vi.fn((key: string) => {
          if (key === 'socketRef') return { current: null };
          return null; // initialDungeon, initialPlayerPositions, localPlayerId all null
        }),
      },
    };
    protected cameras = {
      main: {
        setBounds: vi.fn(), startFollow: vi.fn(), getWorldPoint: vi.fn(() => ({ x: 0, y: 0 })),
        setZoom: vi.fn(),
      },
    };
    // scale.height drives dynamic zoom; scale.on registers the resize listener.
    protected scale = { height: 390, on: vi.fn() };
    protected events = { once: vi.fn(), emit: vi.fn() };
    // delayedCall fires immediately in tests so flash-and-restore is synchronous.
    protected time = { delayedCall: vi.fn((_ms: number, cb: () => void) => cb()) };
    protected add = {
      graphics:  vi.fn(() => makeGraphics()),
      circle:    vi.fn((x: number, y: number) => { const a = makeArc(); a.x = x; a.y = y; return a; }),
      rectangle: vi.fn((x: number, y: number) => { const r = makeRect(); r.x = x; r.y = y; return r; }),
    };
    scene = { key: 'GameScene' };
    constructor(config?: { key?: string }) {}
  }
  return { default: { Scene: FakeScene, Geom, Scenes, Scale, AUTO } };
});

import { GameScene } from './GameScene.js';
import { sceneStore } from './SceneStore.js';
import { DESIGN_VIEW_HEIGHT } from '@veins/shared';

// Build a GameScene that bypasses socket event binding.
function makeScene(): GameScene {
  const scene = new GameScene();
  // Call create() manually — it will get a null socket and skip binding.
  (scene as unknown as { create: () => void }).create();
  return scene;
}

// Helpers to call private-but-testable methods.
function drawDungeon(scene: GameScene, dungeon: Parameters<GameScene['drawDungeon']>[0]) {
  scene.drawDungeon(dungeon);
}

const DUNGEON_3R2C = {
  runId: 'r', width: 1000, height: 1000,
  rooms: [
    { id: 'r0', rect: { x: 0,   y: 0,   width: 200, height: 200 } },
    { id: 'r1', rect: { x: 300, y: 0,   width: 200, height: 200 } },
    { id: 'r2', rect: { x: 600, y: 0,   width: 200, height: 200 } },
  ],
  corridors: [
    { fromId: 'r0', toId: 'r1', from: { x: 200, y: 100 }, to: { x: 300, y: 100 } },
    { fromId: 'r1', toId: 'r2', from: { x: 500, y: 100 }, to: { x: 600, y: 100 } },
  ],
};

describe('GameScene.drawDungeon (T3, R2)', () => {
  it('calls fillRect for rooms + corridor segments', () => {
    // 3 rooms + 2 horizontal corridors (each horizontal = 1 fillRect, dh=0 so no vert segment) = 5.
    const scene = makeScene();
    drawDungeon(scene, DUNGEON_3R2C);
    const gfx = (scene as unknown as { dungeonGraphics: ReturnType<typeof makeGraphics> }).dungeonGraphics;
    expect(gfx.fillRect).toHaveBeenCalledTimes(5);
  });

  it('uses fillRect for corridors — strokeLineShape is never called', () => {
    const scene = makeScene();
    drawDungeon(scene, DUNGEON_3R2C);
    const gfx = (scene as unknown as { dungeonGraphics: ReturnType<typeof makeGraphics> }).dungeonGraphics;
    expect(gfx.strokeLineShape).not.toHaveBeenCalled();
  });

  it('clears before redrawing (idempotent)', () => {
    const scene = makeScene();
    drawDungeon(scene, DUNGEON_3R2C);
    drawDungeon(scene, DUNGEON_3R2C);
    const gfx = (scene as unknown as { dungeonGraphics: ReturnType<typeof makeGraphics> }).dungeonGraphics;
    // clear() called once per drawDungeon call.
    expect(gfx.clear).toHaveBeenCalledTimes(2);
    // fillRect called 5 each time (2 corridors + 3 rooms) → 10 total.
    expect(gfx.fillRect).toHaveBeenCalledTimes(10);
  });
});

describe('GameScene dynamic zoom (T4, R1)', () => {
  it('setZoom called with scale.height / DESIGN_VIEW_HEIGHT on create', () => {
    const scene = makeScene();
    const cam = (scene as unknown as { cameras: { main: { setZoom: ReturnType<typeof vi.fn> } } }).cameras.main;
    const mockScale = (scene as unknown as { scale: { height: number; on: ReturnType<typeof vi.fn> } }).scale;
    expect(cam.setZoom).toHaveBeenCalledWith(mockScale.height / DESIGN_VIEW_HEIGHT);
  });

  it('resize listener registered on scale', () => {
    const scene = makeScene();
    const mockScale = (scene as unknown as { scale: { height: number; on: ReturnType<typeof vi.fn> } }).scale;
    expect(mockScale.on).toHaveBeenCalledWith('resize', expect.any(Function));
  });
});

describe('GameScene player sprites (T4, R3, R4)', () => {
  // Regression: aim must be accurate before the first PLAYER_MOVED — the local
  // spawn seeds sceneStore.localPlayerPos so mouse-aim doesn't use the off-centre
  // screen fallback.
  it('seeds sceneStore.localPlayerPos on local spawn', () => {
    const scene = makeScene();
    scene.addOrUpdatePlayer('me', 50, 60, true);
    expect(sceneStore.localPlayerPos).toEqual({ x: 50, y: 60 });
  });

  it('does NOT set localPlayerPos for a remote spawn', () => {
    sceneStore.localPlayerPos = null;
    const scene = makeScene();
    scene.addOrUpdatePlayer('other', 70, 80, false);
    expect(sceneStore.localPlayerPos).toBeNull();
  });

  it('PLAYER_MOVED updates the interpolation target (arc lerps toward it on update)', () => {
    const scene = makeScene();
    scene.addOrUpdatePlayer('p1', 0, 0, true);
    scene.movePlayer('p1', 100, 200);
    // With a very large dt the lerp factor → 1, arc snaps to the target position.
    (scene as unknown as { update: (t: number, d: number) => void }).update(0, 10_000);
    const { players } = scene as unknown as { players: Map<string, { arc: { x: number; y: number } }> };
    expect(players.get('p1')!.arc.x).toBeCloseTo(100, 0);
    expect(players.get('p1')!.arc.y).toBeCloseTo(200, 0);
  });

  it('PLAYER_DOWNED sets arc color to 0x555555', () => {
    const scene = makeScene();
    scene.addOrUpdatePlayer('p1', 0, 0, false);
    scene.downPlayer('p1');
    const { players } = scene as unknown as { players: Map<string, { arc: ReturnType<typeof makeArc> }> };
    expect(players.get('p1')!.arc.setFillStyle).toHaveBeenCalledWith(0x555555);
  });

  it('PLAYER_REVIVED restores remote player arc color', () => {
    const scene = makeScene();
    scene.addOrUpdatePlayer('p2', 0, 0, false);
    scene.downPlayer('p2');
    scene.revivePlayer('p2');
    const { players } = scene as unknown as { players: Map<string, { arc: ReturnType<typeof makeArc> }> };
    const calls = players.get('p2')!.arc.setFillStyle.mock.calls;
    // Last call should restore to remote color 0xffaa44.
    expect(calls[calls.length - 1]).toEqual([0xffaa44]);
  });

  it('flashPlayerDamage: sets arc to hit-flash color then restores', () => {
    const scene = makeScene();
    scene.addOrUpdatePlayer('p1', 0, 0, true); // local player (blue)
    const { players } = scene as unknown as { players: Map<string, { arc: ReturnType<typeof makeArc> }> };
    const arc = players.get('p1')!.arc;
    scene.flashPlayerDamage('p1');
    // After flash + immediate restore via fake delayedCall, ends on normal color.
    const calls = arc.setFillStyle.mock.calls;
    expect(calls.some(c => c[0] === 0xff2222)).toBe(true); // flash color emitted
    expect(calls[calls.length - 1][0]).toBe(0x44aaff);     // restored to local-player color
  });

  it('flashPlayerDamage: does not flash a downed player', () => {
    const scene = makeScene();
    scene.addOrUpdatePlayer('p2', 0, 0, false);
    scene.downPlayer('p2');
    const { players } = scene as unknown as { players: Map<string, { arc: ReturnType<typeof makeArc> }> };
    const arc = players.get('p2')!.arc;
    arc.setFillStyle.mockClear();
    scene.flashPlayerDamage('p2');
    expect(arc.setFillStyle).not.toHaveBeenCalled();
  });

  it('flashPlayerDamage: no-ops for unknown player id', () => {
    const scene = makeScene();
    // Should not throw.
    expect(() => scene.flashPlayerDamage('ghost')).not.toThrow();
  });
});

describe('GameScene enemy containers (T5, R5, R6)', () => {
  it('ENEMY_SPAWNED creates a container entry', () => {
    const scene = makeScene();
    scene.spawnEnemy('e1', 50, 50, 60);
    const { enemies } = scene as unknown as { enemies: Map<string, EnemyContainer> };
    expect(enemies.has('e1')).toBe(true);
  });

  it('ENEMY_DIED removes the container', () => {
    const scene = makeScene();
    scene.spawnEnemy('e1', 50, 50, 60);
    scene.killEnemy('e1');
    const { enemies } = scene as unknown as { enemies: Map<string, EnemyContainer> };
    expect(enemies.has('e1')).toBe(false);
  });

  it('ENEMY_DAMAGED updates HP bar scale proportionally', () => {
    const scene = makeScene();
    scene.spawnEnemy('e1', 50, 50, 100);
    scene.damageEnemy('e1', 50); // 50/100 = 0.5
    const { enemies } = scene as unknown as { enemies: Map<string, EnemyContainer> };
    expect(enemies.get('e1')!.hpFill.setScale).toHaveBeenCalledWith(0.5, 1);
  });

  it('ENEMY_DAMAGED at 0 hp sets scale to 0, not negative', () => {
    const scene = makeScene();
    scene.spawnEnemy('e1', 50, 50, 100);
    scene.damageEnemy('e1', 0);
    const { enemies } = scene as unknown as { enemies: Map<string, EnemyContainer> };
    expect(enemies.get('e1')!.hpFill.setScale).toHaveBeenCalledWith(0, 1);
  });

  it('spitter spawns with smaller size than shambler (purple vs red)', () => {
    const scene = makeScene();
    scene.spawnEnemy('shambler-1', 0, 0, 60, 'shambler');
    scene.spawnEnemy('spitter-1', 10, 0, 30, 'spitter');
    // Both exist; spitter is tracked in the enemies map.
    const { enemies } = scene as unknown as { enemies: Map<string, EnemyContainer> };
    expect(enemies.has('shambler-1')).toBe(true);
    expect(enemies.has('spitter-1')).toBe(true);
    // Verify add.rectangle was called with different sizes.
    const addCalls = (scene as unknown as { add: { rectangle: ReturnType<typeof vi.fn> } }).add.rectangle.mock.calls;
    const shamblerCall = addCalls.find((c: unknown[]) => c[0] === 0); // shambler at x=0
    const spitterCall  = addCalls.find((c: unknown[]) => c[0] === 10); // spitter at x=10
    // shambler size arg (index 2 & 3) should be larger than spitter
    expect(shamblerCall![2]).toBeGreaterThan(spitterCall![2]);
    // colors differ
    expect(shamblerCall![4]).not.toBe(spitterCall![4]);
  });
});

type EnemyContainer = {
  rect: ReturnType<typeof makeRect>;
  hpBg: ReturnType<typeof makeRect>;
  hpFill: ReturnType<typeof makeRect>;
  maxHp: number;
};

describe('GameScene auto-aim ring (T7, R9)', () => {
  it('showAimRing with a known enemy id makes ring visible at enemy position', () => {
    const scene = makeScene();
    scene.spawnEnemy('e1', 100, 200, 60);
    scene.showAimRing('e1');
    const { aimRing } = scene as unknown as { aimRing: ReturnType<typeof makeGraphics> };
    expect(aimRing.setVisible).toHaveBeenCalledWith(true);
    expect(aimRing.setPosition).toHaveBeenCalledWith(expect.any(Number), expect.any(Number));
  });

  it('showAimRing with null hides the ring', () => {
    const scene = makeScene();
    scene.showAimRing(null);
    const { aimRing } = scene as unknown as { aimRing: ReturnType<typeof makeGraphics> };
    expect(aimRing.setVisible).toHaveBeenCalledWith(false);
  });

  it('showAimRing with unknown enemy id hides the ring', () => {
    const scene = makeScene();
    scene.showAimRing('no-such-enemy');
    const { aimRing } = scene as unknown as { aimRing: ReturnType<typeof makeGraphics> };
    expect(aimRing.setVisible).toHaveBeenCalledWith(false);
  });

  // Regression (B1): the ring follows its target as the enemy moves.
  it('update() re-pins the ring to the target enemy as it moves', () => {
    const scene = makeScene();
    scene.spawnEnemy('target', 100, 100, 60);
    scene.showAimRing('target');
    scene.moveEnemy('target', 100, 300);
    (scene as unknown as { update: (t: number, d: number) => void }).update(0, 10_000); // snap
    const { aimRing } = scene as unknown as { aimRing: ReturnType<typeof makeGraphics> };
    expect(aimRing.visible).toBe(true);
    expect(aimRing.y).toBeCloseTo(300, 0);
  });

  // Regression (B2): an unrelated enemy dying must not drop a live aim lock.
  it('keeps the ring locked when a DIFFERENT enemy dies, hides it only when the target dies', () => {
    const scene = makeScene();
    scene.spawnEnemy('target', 100, 100, 60);
    scene.spawnEnemy('other', 300, 300, 60);
    scene.showAimRing('target');
    const update = (scene as unknown as { update: (t: number, d: number) => void }).update.bind(scene);
    const { aimRing } = scene as unknown as { aimRing: ReturnType<typeof makeGraphics> };

    scene.killEnemy('other');
    update(0, 16);
    expect(aimRing.visible).toBe(true); // still locked on 'target'

    scene.killEnemy('target');
    update(0, 16);
    expect(aimRing.visible).toBe(false); // target gone → ring hides
  });
});

describe('GameScene camera (T6, R7)', () => {
  it('drawDungeon calls setBounds with dungeon width and height', () => {
    const scene = makeScene();
    drawDungeon(scene, DUNGEON_3R2C);
    const cam = (scene as unknown as { cameras: { main: { setBounds: ReturnType<typeof vi.fn> } } }).cameras.main;
    expect(cam.setBounds).toHaveBeenCalledWith(0, 0, DUNGEON_3R2C.width, DUNGEON_3R2C.height);
  });

  // Regression (desktop aim offset): create() must expose the camera to sceneStore
  // synchronously. The previous code did this in a Scenes.Events.READY listener,
  // but READY fires BEFORE create() runs, so the listener never fired and
  // sceneStore.camera stayed null — forcing mouse-aim onto the off-centre screen
  // fallback. App's emitAim needs this camera to convert the cursor to world coords.
  it('exposes cameras.main on sceneStore after create (not via a READY listener)', () => {
    sceneStore.camera = null;
    const scene = makeScene();
    const cam = (scene as unknown as { cameras: { main: unknown } }).cameras.main;
    expect(sceneStore.camera).toBe(cam);
  });
});

type ProjectileEntry = { dot: ReturnType<typeof makeArc>; vx: number; vy: number };

describe('GameScene projectiles + enemy movement (T6-weapon, R9)', () => {
  it('spawnProjectile creates an entry in the projectiles map', () => {
    const scene = makeScene();
    scene.spawnProjectile('proj-0', 50, 60, 1, 0);
    const { projectiles } = scene as unknown as { projectiles: Map<string, ProjectileEntry> };
    expect(projectiles.has('proj-0')).toBe(true);
  });

  it('spawnProjectile stores velocity derived from dx,dy and PROJECTILE_SPEED', async () => {
    const { PROJECTILE_SPEED } = await import('@veins/shared');
    const scene = makeScene();
    scene.spawnProjectile('proj-0', 0, 0, 1, 0);
    const { projectiles } = scene as unknown as { projectiles: Map<string, ProjectileEntry> };
    expect(projectiles.get('proj-0')!.vx).toBeCloseTo(PROJECTILE_SPEED);
    expect(projectiles.get('proj-0')!.vy).toBeCloseTo(0);
  });

  it('update() moves projectiles by vx*dt, vy*dt each frame', () => {
    const scene = makeScene();
    scene.spawnProjectile('proj-0', 0, 0, 1, 0); // vx = PROJECTILE_SPEED
    (scene as unknown as { update: (t: number, d: number) => void }).update(0, 100); // dt = 0.1s
    const { projectiles } = scene as unknown as { projectiles: Map<string, ProjectileEntry> };
    // dot.x should have advanced by PROJECTILE_SPEED * 0.1
    expect(projectiles.get('proj-0')!.dot.x).toBeGreaterThan(0);
  });

  it('removeProjectile destroys the circle and removes the map entry', () => {
    const scene = makeScene();
    scene.spawnProjectile('proj-0', 50, 60, 0, 1);
    scene.removeProjectile('proj-0');
    const { projectiles } = scene as unknown as { projectiles: Map<string, ProjectileEntry> };
    expect(projectiles.has('proj-0')).toBe(false);
  });

  it('spawnProjectile is idempotent (calling twice does not double-add)', () => {
    const scene = makeScene();
    scene.spawnProjectile('proj-0', 50, 60, 1, 0);
    scene.spawnProjectile('proj-0', 50, 60, 1, 0);
    const { projectiles } = scene as unknown as { projectiles: Map<string, ProjectileEntry> };
    expect(projectiles.size).toBe(1);
  });

  it('moveEnemy sets interpolation target; update() drives rect + HP bar toward it', () => {
    const scene = makeScene();
    scene.spawnEnemy('e1', 0, 0, 60);
    scene.moveEnemy('e1', 200, 300);
    // Large dt collapses lerp factor to 1 → immediate snap.
    (scene as unknown as { update: (t: number, d: number) => void }).update(0, 10_000);
    const { enemies } = scene as unknown as { enemies: Map<string, { rect: { x: number; y: number }; hpBg: ReturnType<typeof makeRect>; hpFill: ReturnType<typeof makeRect>; maxHp: number }> };
    expect(enemies.get('e1')!.rect.x).toBeCloseTo(200, 0);
    expect(enemies.get('e1')!.rect.y).toBeCloseTo(300, 0);
    expect(enemies.get('e1')!.hpBg.setPosition).toHaveBeenCalled();
    expect(enemies.get('e1')!.hpFill.setPosition).toHaveBeenCalled();
  });

  it('moveEnemy for unknown id is a no-op (does not throw)', () => {
    const scene = makeScene();
    expect(() => scene.moveEnemy('ghost', 100, 100)).not.toThrow();
  });
});

// --- Socket-driven tests (RUN_STARTED, camera follow) ---

type FakeSocket = {
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  emit: ReturnType<typeof vi.fn>;
  handlers: Map<string, (...args: unknown[]) => void>;
};

function makeSocket(): FakeSocket {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  return {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => { handlers.set(event, handler); }),
    off: vi.fn(),
    emit: vi.fn(),
    handlers,
  };
}

function makeSceneWithSocket(socket: FakeSocket, localPlayerId = ''): GameScene {
  const scene = new GameScene();
  const registryGet = vi.fn((key: string) => {
    if (key === 'socketRef') return { current: socket };
    if (key === 'localPlayerId') return localPlayerId;
    return null;
  });
  (scene as unknown as { game: { registry: { get: ReturnType<typeof vi.fn> } } }).game.registry.get = registryGet;
  (scene as unknown as { create: () => void }).create();
  return scene;
}

const MINIMAL_DUNGEON = {
  runId: 'r', width: 400, height: 400,
  rooms: [{ id: 'r0', rect: { x: 0, y: 0, width: 200, height: 200 } }],
  corridors: [],
};

describe('GameScene RUN_STARTED handler', () => {
  it('draws dungeon on RUN_STARTED', () => {
    const socket = makeSocket();
    const scene = makeSceneWithSocket(socket, 'p1');
    socket.handlers.get('RUN_STARTED')!({
      dungeon: MINIMAL_DUNGEON,
      playerPositions: { p1: { x: 100, y: 100 } },
      board: { slots: {} }, synergyMap: {}, relicRegistry: {}, lootPools: {},
    });
    const gfx = (scene as unknown as { dungeonGraphics: ReturnType<typeof makeGraphics> }).dungeonGraphics;
    expect(gfx.fillRect).toHaveBeenCalledTimes(1);
  });

  it('spawns all players at their initial positions', () => {
    const socket = makeSocket();
    const scene = makeSceneWithSocket(socket, 'p1');
    socket.handlers.get('RUN_STARTED')!({
      dungeon: MINIMAL_DUNGEON,
      playerPositions: { p1: { x: 10, y: 20 }, p2: { x: 30, y: 40 } },
      board: { slots: {} }, synergyMap: {}, relicRegistry: {}, lootPools: {},
    });
    const { players } = scene as unknown as { players: Map<string, { arc: ReturnType<typeof makeArc>; isLocal: boolean }> };
    expect(players.size).toBe(2);
    expect(players.get('p1')!.isLocal).toBe(true);
    expect(players.get('p2')!.isLocal).toBe(false);
  });

  it('starts camera follow for the local player arc', () => {
    const socket = makeSocket();
    const scene = makeSceneWithSocket(socket, 'p1');
    socket.handlers.get('RUN_STARTED')!({
      dungeon: MINIMAL_DUNGEON,
      playerPositions: { p1: { x: 10, y: 20 } },
      board: { slots: {} }, synergyMap: {}, relicRegistry: {}, lootPools: {},
    });
    const cam = (scene as unknown as { cameras: { main: { startFollow: ReturnType<typeof vi.fn> } } }).cameras.main;
    expect(cam.startFollow).toHaveBeenCalled();
  });

  it('does NOT start camera follow for remote players', () => {
    const socket = makeSocket();
    const scene = makeSceneWithSocket(socket, 'p1');
    // Only p2 in playerPositions (p1 absent — edge case)
    socket.handlers.get('RUN_STARTED')!({
      dungeon: MINIMAL_DUNGEON,
      playerPositions: { p2: { x: 30, y: 40 } },
      board: { slots: {} }, synergyMap: {}, relicRegistry: {}, lootPools: {},
    });
    const cam = (scene as unknown as { cameras: { main: { startFollow: ReturnType<typeof vi.fn> } } }).cameras.main;
    expect(cam.startFollow).not.toHaveBeenCalled();
  });
});

describe('GameScene FLOOR_ADVANCED handler', () => {
  const NEXT_DUNGEON = {
    runId: 'r', width: 400, height: 400,
    rooms: [{ id: 'r0', rect: { x: 0, y: 0, width: 400, height: 400 } }],
    corridors: [],
  };

  it('snaps players to the entry positions carried by the event (no lerp slide)', () => {
    const socket = makeSocket();
    const scene = makeSceneWithSocket(socket, 'p1');
    socket.handlers.get('RUN_STARTED')!({
      dungeon: MINIMAL_DUNGEON,
      playerPositions: { p1: { x: 10, y: 20 }, p2: { x: 30, y: 40 } },
      board: { slots: {} }, synergyMap: {}, relicRegistry: {}, lootPools: {},
    });

    socket.handlers.get('FLOOR_ADVANCED')!({
      floor: 2,
      dungeon: NEXT_DUNGEON,
      playerPositions: { p1: { x: 200, y: 200 }, p2: { x: 200, y: 200 } },
    });

    const { players } = scene as unknown as { players: Map<string, { arc: { x: number; y: number } }> };
    // Sprite is snapped immediately (not just the lerp target), so it renders at
    // the entry on the very first frame of the new floor.
    expect(players.get('p1')!.arc.x).toBe(200);
    expect(players.get('p1')!.arc.y).toBe(200);
    expect(players.get('p2')!.arc.x).toBe(200);
    expect(players.get('p2')!.arc.y).toBe(200);
  });

  it('does not throw when the event carries no playerPositions (back-compat)', () => {
    const socket = makeSocket();
    const scene = makeSceneWithSocket(socket, 'p1');
    socket.handlers.get('RUN_STARTED')!({
      dungeon: MINIMAL_DUNGEON,
      playerPositions: { p1: { x: 10, y: 20 } },
      board: { slots: {} }, synergyMap: {}, relicRegistry: {}, lootPools: {},
    });
    expect(() =>
      socket.handlers.get('FLOOR_ADVANCED')!({ floor: 2, dungeon: NEXT_DUNGEON })
    ).not.toThrow();
  });
});
