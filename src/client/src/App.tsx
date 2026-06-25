import { useCallback, useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { useSocket, getStablePlayerId } from './hooks/useSocket.js';
import { VirtualJoystick } from './components/VirtualJoystick.js';
import { HUD } from './components/HUD.js';
import { BoardPanel } from './components/BoardPanel.js';
import { LobbyScreen } from './components/LobbyScreen.js';
import { WaitingRoom } from './components/WaitingRoom.js';
import { PostRunScreen } from './components/PostRunScreen.js';
import { DescendPanel } from './components/DescendPanel.js';
import { PhaseToast } from './components/PhaseToast.js';
import { GameScene } from './game/GameScene.js';
import { sceneStore } from './game/SceneStore.js';
import type { GamePhase, RoomSummary, RelicBoard, SynergyMap, Relic, RoomUpdateEvent, DungeonLayout, StateResyncEvent } from '@veins/shared';

// How long (ms) a player must keep the mouse still before auto-aim re-activates.
const MOUSE_IDLE_MS = 500;

// The active run's room code is persisted so a refresh/reconnect can rejoin (R6).
const ROOM_CODE_KEY = 'veins.roomCode';
function rememberRoomCode(code: string): void { try { sessionStorage.setItem(ROOM_CODE_KEY, code); } catch { /* ignore */ } }
function forgetRoomCode(): void { try { sessionStorage.removeItem(ROOM_CODE_KEY); } catch { /* ignore */ } }
function storedRoomCode(): string | null { try { return sessionStorage.getItem(ROOM_CODE_KEY); } catch { return null; } }

type Screen = 'lobby' | 'waiting' | 'game' | 'post-run';

type RunData = {
  board: RelicBoard;
  synergyMap: SynergyMap;
  relicRegistry: Record<string, Relic>;
  lootPool: string[];
  dungeon: DungeonLayout;
  playerPositions: Record<string, { x: number; y: number }>;
};

type RunEndData = { outcome: 'wiped' | 'extracted'; finalFloor: number; enemiesKilled: number };

export function App() {
  const socketRef = useSocket();
  const gameRef = useRef<Phaser.Game | null>(null);

  const [screen, setScreen] = useState<Screen>('lobby');
  const [roomSummary, setRoomSummary] = useState<RoomSummary | null>(null);
  const [runData, setRunData] = useState<RunData | null>(null);
  const [runEndData, setRunEndData] = useState<RunEndData | null>(null);
  const [phase, setPhase] = useState<GamePhase>('loot');
  const [localPlayerId] = useState<string>(() => getStablePlayerId());
  const [connected, setConnected] = useState<boolean>(false);

  // Derived — no extra state.
  const players = roomSummary?.players ?? [];

  // Mount Phaser.Game only when the game screen is active (P3: lazy mount).
  useEffect(() => {
    if (screen !== 'game') return;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      backgroundColor: '#0d0d0d',
      scene: [GameScene],
      parent: 'game-container',
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: window.innerWidth,
        height: window.innerHeight,
      },
    };
    const game = new Phaser.Game(config);
    gameRef.current = game;
    game.registry.set('socketRef', socketRef);
    game.registry.set('localPlayerId', localPlayerId);
    game.registry.set('initialDungeon', runData?.dungeon ?? null);
    game.registry.set('initialPlayerPositions', runData?.playerPositions ?? null);

    return () => {
      game.destroy(true);
      gameRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  // Track local player ID and drive screen transitions from socket events.
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    if (socket.connected) setConnected(true);

    // On (re)connect, if we still remember an active run, ask to rejoin it (R6).
    function attemptRejoin() {
      const code = storedRoomCode();
      if (code) socket!.emit('rejoin', { code });
    }
    if (socket.connected) attemptRejoin();

    function onConnect() { setConnected(true); attemptRejoin(); }
    function onDisconnect() { setConnected(false); }

    // P2: read ev.room (RoomUpdateEvent shape) — not ev directly.
    function onRoomUpdate(ev: RoomUpdateEvent) {
      setRoomSummary(ev.room);
      rememberRoomCode(ev.room.code);
      setScreen('waiting');
    }

    // P1: capture payload so BoardPanel has initial state on first render.
    function onRunStarted(ev: RunData & { phase?: GamePhase }) {
      setRunData(ev);
      setPhase(ev.phase ?? 'combat');
      setScreen('game');
    }

    // Reconnection: rebuild render state from the full snapshot and re-enter the game (R6).
    function onStateResync(ev: StateResyncEvent) {
      setRoomSummary(ev.room);
      rememberRoomCode(ev.room.code);
      setRunData({
        board: ev.board,
        synergyMap: ev.synergyMap,
        relicRegistry: ev.relicRegistry,
        lootPool: ev.lootPool,
        dungeon: ev.dungeon as DungeonLayout, // an in-progress resync always carries a dungeon
        playerPositions: Object.fromEntries(
          Object.entries(ev.playerStates).map(([id, s]) => [id, { x: s.x, y: s.y }])
        ),
      });
      setPhase(ev.phase);
      setScreen('game');
    }

    function onPhaseChanged(ev: { phase: GamePhase }) {
      setPhase(ev.phase);
    }

    function onRunEnded(ev: { outcome: string; finalFloor: number; enemiesKilled: number }) {
      forgetRoomCode();
      setRunEndData({ outcome: ev.outcome as 'wiped' | 'extracted', finalFloor: ev.finalFloor, enemiesKilled: ev.enemiesKilled ?? 0 });
      setScreen('post-run');
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('ROOM_UPDATE', onRoomUpdate);
    socket.on('RUN_STARTED', onRunStarted);
    socket.on('STATE_RESYNC', onStateResync);
    socket.on('PHASE_CHANGED', onPhaseChanged);
    socket.on('RUN_ENDED', onRunEnded);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('ROOM_UPDATE', onRoomUpdate);
      socket.off('RUN_STARTED', onRunStarted);
      socket.off('STATE_RESYNC', onStateResync);
      socket.off('PHASE_CHANGED', onPhaseChanged);
      socket.off('RUN_ENDED', onRunEnded);
    };
  }, [socketRef]);

  // WASD / arrow-key movement for desktop. Sends a direction vector on every
  // animation frame while keys are held. The server rate-limits to one move per
  // combat tick, so flooding at 60fps is safe.
  useEffect(() => {
    const held = new Set<string>();

    function onKeyDown(e: KeyboardEvent) {
      held.add(e.key.toLowerCase());
    }
    function onKeyUp(e: KeyboardEvent) {
      held.delete(e.key.toLowerCase());
    }

    let rafId: number;
    let wasMoving = false;
    function tick() {
      const socket = socketRef.current;
      if (socket) {
        let dx = 0, dy = 0;
        if (held.has('w') || held.has('arrowup'))    dy -= 1;
        if (held.has('s') || held.has('arrowdown'))  dy += 1;
        if (held.has('a') || held.has('arrowleft'))  dx -= 1;
        if (held.has('d') || held.has('arrowright')) dx += 1;
        const moving = dx !== 0 || dy !== 0;
        if (moving) {
          const mag = Math.sqrt(dx * dx + dy * dy);
          socket.emit('move-player', { dx: dx / mag, dy: dy / mag });
        } else if (wasMoving) {
          // Key(s) just released — tell server to stop.
          socket.emit('move-player', { dx: 0, dy: 0 });
        }
        wasMoving = moving;
      }
      rafId = requestAnimationFrame(tick);
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    rafId = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      cancelAnimationFrame(rafId);
    };
  }, [socketRef]);

  // Mouse-aim: always registered (harmless before joining a room).
  useEffect(() => {
    let idleTimer: ReturnType<typeof setTimeout> | null = null;

    function onMouseMove(e: MouseEvent) {
      const socket = socketRef.current;
      if (!socket) return;

      const { camera, localPlayerPos } = sceneStore;
      let dx: number, dy: number;
      if (camera && localPlayerPos) {
        const world = camera.getWorldPoint(e.clientX, e.clientY);
        dx = world.x - localPlayerPos.x;
        dy = world.y - localPlayerPos.y;
      } else {
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        dx = e.clientX - cx;
        dy = e.clientY - cy;
      }

      socket.emit('aim-player', { dx, dy });

      if (idleTimer !== null) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        socket.emit('aim-player', { dx: 0, dy: 0 });
        idleTimer = null;
      }, MOUSE_IDLE_MS);
    }

    window.addEventListener('mousemove', onMouseMove);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      if (idleTimer !== null) clearTimeout(idleTimer);
    };
  }, [socketRef]);

  const handleMove = useCallback(
    (dx: number, dy: number) => {
      socketRef.current?.emit('move-player', { dx, dy });
    },
    [socketRef]
  );

  const handleAim = useCallback(
    (dx: number, dy: number) => {
      socketRef.current?.emit('aim-player', { dx, dy });
    },
    [socketRef]
  );

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {screen === 'lobby' && <LobbyScreen socketRef={socketRef} connected={connected} />}

      {screen === 'waiting' && roomSummary && (
        <WaitingRoom socketRef={socketRef} room={roomSummary} localPlayerId={localPlayerId} connected={connected} />
      )}

      {screen === 'game' && (
        <>
          <div id="game-container" style={{ width: '100%', height: '100%' }} />
          <HUD socketRef={socketRef} localPlayerId={localPlayerId} players={players} />
          <BoardPanel
            socketRef={socketRef}
            localPlayerId={localPlayerId}
            phase={phase}
            players={players}
            initialBoard={runData?.board}
            initialSynergyMap={runData?.synergyMap}
            initialRegistry={runData?.relicRegistry}
            initialLootPool={runData?.lootPool}
          />
          <DescendPanel socketRef={socketRef} phase={phase} />
          <PhaseToast socketRef={socketRef} />
          <VirtualJoystick onMove={handleMove} onAim={handleAim} />
        </>
      )}

      {screen === 'post-run' && runEndData && (
        <PostRunScreen
          outcome={runEndData.outcome}
          finalFloor={runEndData.finalFloor}
          enemiesKilled={runEndData.enemiesKilled}
          onReturnToLobby={() => { setScreen('lobby'); setRunEndData(null); forgetRoomCode(); }}
        />
      )}
    </div>
  );
}
