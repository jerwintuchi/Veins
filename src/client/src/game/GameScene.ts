import Phaser from 'phaser';
import type { Socket } from 'socket.io-client';
import type {
  DungeonLayout,
  PlayerId,
  GamePhase,
} from '@veins/shared';
import type { EnemyTypeId } from '@veins/shared';
import type {
  EnemySpawnedEvent,
  EnemyDamagedEvent,
  PlayerMovedEvent,
  PlayerDownedEvent,
  PlayerRevivedEvent,
  PlayerAimChangedEvent,
  PlayerDamagedEvent,
  FloorAdvancedEvent,
  BleedClockTickEvent,
  BleedStageChangedEvent,
  PhaseChangedEvent,
  ProjectileFiredEvent,
  ProjectileRemovedEvent,
  EnemyMovedEvent,
  RunStartedEvent,
} from '@veins/shared';
import {
  PROJECTILE_SPEED,
  CORRIDOR_HALF_WIDTH,
  PLAYER_RADIUS,
  ENEMY_RADIUS_SHAMBLER,
  ENEMY_RADIUS_SPITTER,
  DESIGN_VIEW_HEIGHT,
} from '@veins/shared';
import { sceneStore } from './SceneStore.js';
import { SoundManager } from './SoundManager.js';

// Placeholder colors (swapped for sprites in the art pass).
const COLOR_LOCAL_PLAYER  = 0x44aaff;
const COLOR_REMOTE_PLAYER = 0xffaa44;
const COLOR_DOWNED        = 0x555555;
const COLOR_HIT_FLASH     = 0xff2222;
const HIT_FLASH_MS        = 200;
const COLOR_ENEMY_SHAMBLER = 0xee4444; // melee — red
const COLOR_ENEMY_SPITTER  = 0xcc44ee; // ranged — purple
const COLOR_HP_BG         = 0x333333;
const COLOR_HP_FILL       = 0xee4444;
const COLOR_AIM_RING      = 0xffff00;
const COLOR_ROOM          = 0x2a2a2a;
const COLOR_CORRIDOR      = 0x1a1a1a;

// PLAYER_RADIUS, ENEMY_RADIUS_SHAMBLER, ENEMY_RADIUS_SPITTER imported from @veins/shared.
// Visual sizes are 2× the collision radius so the render footprint matches the server hitbox.
const ENEMY_SIZE_SHAMBLER = ENEMY_RADIUS_SHAMBLER * 2;
const ENEMY_SIZE_SPITTER  = ENEMY_RADIUS_SPITTER  * 2;
const HP_BAR_W      = 24;
const HP_BAR_H      = 4;
const HP_BAR_OFFSET = 16; // px above enemy centre
const AIM_RING_R    = 16;

type PlayerArc = { arc: Phaser.GameObjects.Arc; isLocal: boolean };

type EnemyContainer = {
  rect:   Phaser.GameObjects.Rectangle;
  hpBg:   Phaser.GameObjects.Rectangle;
  hpFill: Phaser.GameObjects.Rectangle;
  maxHp:  number;
};

type ProjectileEntry = { dot: Phaser.GameObjects.Arc; vx: number; vy: number };

const COLOR_PROJECTILE = 0xffffff;
const PROJECTILE_RADIUS = 4;

export class GameScene extends Phaser.Scene {
  private dungeonGraphics!: Phaser.GameObjects.Graphics;
  private aimRing!: Phaser.GameObjects.Graphics;

  private players = new Map<PlayerId, PlayerArc>();
  private enemies = new Map<string, EnemyContainer>();
  private projectiles = new Map<string, ProjectileEntry>();
  private localPlayerId: PlayerId | null = null;

  // Reference to the socket wired in by App.tsx via game.registry.
  private socket: Socket | null = null;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    // Retrieve socket and localPlayerId from registry (set by App.tsx after game construction).
    const socketRef = this.game.registry.get('socketRef') as { current: Socket | null } | undefined;
    this.socket = socketRef?.current ?? null;
    this.localPlayerId = (this.game.registry.get('localPlayerId') as PlayerId | undefined) ?? null;

    // Dynamic zoom: everyone sees the same world area regardless of device.
    // scale.height is the CSS-pixel viewport height; dividing by DESIGN_VIEW_HEIGHT
    // gives the pixels-per-world-unit ratio that fills the screen with exactly
    // DESIGN_VIEW_HEIGHT world units vertically.
    this.cameras.main.setZoom(this.scale.height / DESIGN_VIEW_HEIGHT);
    this.scale.on('resize', (_size: Phaser.Structs.Size) => {
      this.cameras.main.setZoom(this.scale.height / DESIGN_VIEW_HEIGHT);
    });

    this.dungeonGraphics = this.add.graphics();

    // Aim ring drawn once at origin; repositioned dynamically.
    this.aimRing = this.add.graphics();
    this.aimRing.lineStyle(2, COLOR_AIM_RING, 1);
    this.aimRing.strokeCircle(0, 0, AIM_RING_R);
    this.aimRing.setVisible(false);
    this.aimRing.setDepth(10);

    this.bindSocketEvents();

    // RUN_STARTED fires before Phaser is ready, so the dungeon and player
    // positions are passed via the game registry instead of socket events.
    const initialDungeon = this.game.registry.get('initialDungeon') as DungeonLayout | null;
    const initialPositions = this.game.registry.get('initialPlayerPositions') as Record<string, { x: number; y: number }> | null;
    if (initialDungeon) {
      this.drawDungeon(initialDungeon);
      if (initialPositions) {
        for (const [id, pos] of Object.entries(initialPositions)) {
          this.addOrUpdatePlayer(id, pos.x, pos.y, id === this.localPlayerId);
        }
      }
    }
  }

  // --- dungeon ---

  drawDungeon(dungeon: DungeonLayout): void {
    this.dungeonGraphics.clear();

    // Draw corridor L-shapes first (behind rooms) so room fill covers the overlap.
    const hw = CORRIDOR_HALF_WIDTH;
    this.dungeonGraphics.fillStyle(COLOR_CORRIDOR);
    for (const c of dungeon.corridors) {
      const dw = Math.abs(c.to.x - c.from.x);
      const dh = Math.abs(c.to.y - c.from.y);
      if (dw > 0) {
        this.dungeonGraphics.fillRect(
          Math.min(c.from.x, c.to.x), c.from.y - hw,
          dw, hw * 2,
        );
      }
      if (dh > 0) {
        this.dungeonGraphics.fillRect(
          c.to.x - hw, Math.min(c.from.y, c.to.y),
          hw * 2, dh,
        );
      }
    }

    for (const room of dungeon.rooms) {
      this.dungeonGraphics.fillStyle(COLOR_ROOM);
      this.dungeonGraphics.fillRect(room.rect.x, room.rect.y, room.rect.width, room.rect.height);
    }

    // Update world/camera bounds to the dungeon size.
    this.cameras.main.setBounds(0, 0, dungeon.width, dungeon.height);
  }

  // --- players ---

  addOrUpdatePlayer(playerId: PlayerId, x: number, y: number, isLocal: boolean): PlayerArc {
    let entry = this.players.get(playerId);
    if (!entry) {
      const arc = this.add.circle(x, y, PLAYER_RADIUS, isLocal ? COLOR_LOCAL_PLAYER : COLOR_REMOTE_PLAYER);
      arc.setDepth(5);
      entry = { arc, isLocal };
      this.players.set(playerId, entry);
      if (isLocal) {
        this.cameras.main.startFollow(arc as unknown as Phaser.GameObjects.GameObject, true, 0.08, 0.08);
      }
    } else {
      entry.arc.setPosition(x, y);
    }
    return entry;
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    for (const p of this.projectiles.values()) {
      p.dot.x += p.vx * dt;
      p.dot.y += p.vy * dt;
    }
  }

  movePlayer(playerId: PlayerId, x: number, y: number): void {
    const entry = this.players.get(playerId);
    if (!entry) return;
    entry.arc.setPosition(x, y);
    if (entry.isLocal) {
      sceneStore.localPlayerPos = { x, y };
    }
  }

  downPlayer(playerId: PlayerId): void {
    this.players.get(playerId)?.arc.setFillStyle(COLOR_DOWNED);
  }

  revivePlayer(playerId: PlayerId): void {
    const entry = this.players.get(playerId);
    if (!entry) return;
    entry.arc.setFillStyle(entry.isLocal ? COLOR_LOCAL_PLAYER : COLOR_REMOTE_PLAYER);
  }

  flashPlayerDamage(playerId: PlayerId): void {
    const entry = this.players.get(playerId);
    if (!entry || entry.arc.fillColor === COLOR_DOWNED) return; // don't flash over downed state
    const normalColor = entry.isLocal ? COLOR_LOCAL_PLAYER : COLOR_REMOTE_PLAYER;
    entry.arc.setFillStyle(COLOR_HIT_FLASH);
    this.time.delayedCall(HIT_FLASH_MS, () => {
      // Only restore if the player hasn't been downed in the interim.
      if (entry.arc.fillColor !== COLOR_DOWNED) {
        entry.arc.setFillStyle(normalColor);
      }
    });
  }

  // --- enemies ---

  spawnEnemy(id: string, x: number, y: number, hp: number, typeId: EnemyTypeId = 'shambler'): void {
    if (this.enemies.has(id)) return; // idempotent

    const size  = typeId === 'spitter' ? ENEMY_SIZE_SPITTER  : ENEMY_SIZE_SHAMBLER;
    const color = typeId === 'spitter' ? COLOR_ENEMY_SPITTER : COLOR_ENEMY_SHAMBLER;
    const rect = this.add.rectangle(x, y, size, size, color).setDepth(4);
    const hpBg = this.add.rectangle(x, y - HP_BAR_OFFSET, HP_BAR_W, HP_BAR_H, COLOR_HP_BG).setDepth(6);
    const hpFill = this.add.rectangle(x, y - HP_BAR_OFFSET, HP_BAR_W, HP_BAR_H, COLOR_HP_FILL).setDepth(7);
    hpFill.setOrigin(0, 0.5);
    hpFill.setX(x - HP_BAR_W / 2);

    this.enemies.set(id, { rect, hpBg, hpFill, maxHp: hp });
  }

  killEnemy(id: string): void {
    const c = this.enemies.get(id);
    if (!c) return;
    c.rect.destroy();
    c.hpBg.destroy();
    c.hpFill.destroy();
    this.enemies.delete(id);
    // Hide aim ring if it was targeting this enemy.
    if (this.aimRing.visible) this.aimRing.setVisible(false);
  }

  damageEnemy(id: string, hp: number): void {
    const c = this.enemies.get(id);
    if (!c) return;
    const ratio = Math.max(0, hp / c.maxHp);
    c.hpFill.setScale(ratio, 1);
  }

  // --- projectiles ---

  spawnProjectile(id: string, x: number, y: number, dx = 0, dy = 0): void {
    if (this.projectiles.has(id)) return;
    const dot = this.add.circle(x, y, PROJECTILE_RADIUS, COLOR_PROJECTILE).setDepth(6);
    this.projectiles.set(id, { dot, vx: dx * PROJECTILE_SPEED, vy: dy * PROJECTILE_SPEED });
  }

  removeProjectile(id: string): void {
    this.projectiles.get(id)?.dot.destroy();
    this.projectiles.delete(id);
  }

  moveEnemy(id: string, x: number, y: number): void {
    const c = this.enemies.get(id);
    if (!c) return;
    c.rect.setPosition(x, y);
    c.hpBg.setPosition(x, y - HP_BAR_OFFSET);
    c.hpFill.setX(x - HP_BAR_W / 2);
  }

  // --- auto-aim ring ---

  showAimRing(targetId: string | null | undefined): void {
    if (!targetId) {
      this.aimRing.setVisible(false);
      return;
    }
    const c = this.enemies.get(targetId);
    if (!c) {
      this.aimRing.setVisible(false);
      return;
    }
    this.aimRing.setPosition(c.rect.x, c.rect.y);
    this.aimRing.setVisible(true);
  }

  // --- socket event binding ---

  private bindSocketEvents(): void {
    const socket = this.socket;
    if (!socket) return;

    socket.on('RUN_STARTED', (ev: RunStartedEvent) => {
      this.drawDungeon(ev.dungeon);
      // Clear any stale state from a previous run.
      for (const entry of this.players.values()) entry.arc.destroy();
      this.players.clear();
      for (const id of [...this.enemies.keys()]) this.killEnemy(id);
      // Spawn all players at their initial positions.
      for (const [id, pos] of Object.entries(ev.playerPositions)) {
        this.addOrUpdatePlayer(id, pos.x, pos.y, id === this.localPlayerId);
      }
    });

    socket.on('FLOOR_ADVANCED', (ev: FloorAdvancedEvent) => {
      this.drawDungeon(ev.dungeon);
      // Clear stale enemies from the previous floor.
      for (const id of [...this.enemies.keys()]) this.killEnemy(id);
      sceneStore.emitFloorChanged(ev.floor);
    });

    socket.on('ENEMY_SPAWNED', (ev: EnemySpawnedEvent) => {
      this.spawnEnemy(ev.enemyId, ev.x, ev.y, ev.hp, ev.typeId);
    });

    socket.on('ENEMY_DIED', (ev: { enemyId: string }) => {
      this.killEnemy(ev.enemyId);
      SoundManager.enemyDied();
    });

    socket.on('ENEMY_DAMAGED', (ev: EnemyDamagedEvent) => {
      this.damageEnemy(ev.enemyId, ev.hp);
      SoundManager.projectileHit();
    });

    socket.on('ENEMY_MOVED', (ev: EnemyMovedEvent) => {
      this.moveEnemy(ev.enemyId, ev.x, ev.y);
    });

    socket.on('PROJECTILE_FIRED', (ev: ProjectileFiredEvent) => {
      this.spawnProjectile(ev.projectileId, ev.x, ev.y, ev.dx, ev.dy);
      if (ev.playerId === this.localPlayerId) SoundManager.projectileFired();
    });

    socket.on('PROJECTILE_REMOVED', (ev: ProjectileRemovedEvent) => {
      this.removeProjectile(ev.projectileId);
    });

    socket.on('PLAYER_MOVED', (ev: PlayerMovedEvent) => {
      this.movePlayer(ev.playerId, ev.x, ev.y);
    });

    socket.on('PLAYER_DOWNED', (ev: PlayerDownedEvent) => {
      this.downPlayer(ev.playerId);
    });

    socket.on('PLAYER_REVIVED', (ev: PlayerRevivedEvent) => {
      this.revivePlayer(ev.playerId);
    });

    socket.on('PLAYER_DAMAGED', (ev: PlayerDamagedEvent) => {
      this.flashPlayerDamage(ev.playerId);
      if (ev.playerId === this.localPlayerId) SoundManager.playerHit();
    });

    socket.on('PLAYER_AIM_CHANGED', (ev: PlayerAimChangedEvent) => {
      if (ev.playerId !== this.localPlayerId) return; // only local player's ring
      if (ev.mode === 'auto') {
        this.showAimRing(ev.targetId);
      } else {
        this.showAimRing(null);
      }
    });

    socket.on('BLEED_CLOCK_TICK', (ev: BleedClockTickEvent) => {
      sceneStore.emitBleedTick(ev.clock.current, ev.clock.max);
      if (ev.clock.current / ev.clock.max <= 0.1) SoundManager.bleedWarning();
    });

    socket.on('BLEED_STAGE_CHANGED', (ev: BleedStageChangedEvent) => {
      if (ev.stage >= 1) SoundManager.bleedWarning();
    });

    socket.on('PHASE_CHANGED', (ev: PhaseChangedEvent) => {
      sceneStore.emitPhaseChanged(ev.phase as GamePhase);
      if (ev.phase === 'loot') SoundManager.floorCleared();
    });

    // On join, expose the camera to sceneStore (R10).
    this.events.once(Phaser.Scenes.Events.READY, () => {
      sceneStore.camera = this.cameras.main;
    });
  }

  // Called by App.tsx when the server confirms the local player's identity.
  setLocalPlayerId(playerId: PlayerId): void {
    this.localPlayerId = playerId;
  }
}
