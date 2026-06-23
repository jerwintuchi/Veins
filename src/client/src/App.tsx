import { useCallback, useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { useSocket } from './hooks/useSocket.js';
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
import type { GamePhase, RoomSummary, RelicBoard, SynergyMap, Relic, RoomUpdateEvent } from '@veins/shared';

// How long (ms) a player must keep the mouse still before auto-aim re-activates.
const MOUSE_IDLE_MS = 500;

type Screen = 'lobby' | 'waiting' | 'game' | 'post-run';

type RunData = {
  board: RelicBoard;
  synergyMap: SynergyMap;
  relicRegistry: Record<string, Relic>;
  lootPool: string[];
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
  const [localPlayerId, setLocalPlayerId] = useState<string>('');

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

    if (socket.id) setLocalPlayerId(socket.id);

    function onConnect() { setLocalPlayerId(socket!.id ?? ''); }

    // P2: read ev.room (RoomUpdateEvent shape) — not ev directly.
    function onRoomUpdate(ev: RoomUpdateEvent) {
      setRoomSummary(ev.room);
      setScreen('waiting');
    }

    // P1: capture payload so BoardPanel has initial state on first render.
    function onRunStarted(ev: RunData) {
      setRunData(ev);
      setScreen('game');
    }

    function onPhaseChanged(ev: { phase: GamePhase }) {
      setPhase(ev.phase);
    }

    function onRunEnded(ev: { outcome: string; finalFloor: number; enemiesKilled: number }) {
      setRunEndData({ outcome: ev.outcome as 'wiped' | 'extracted', finalFloor: ev.finalFloor, enemiesKilled: ev.enemiesKilled ?? 0 });
      setScreen('post-run');
    }

    socket.on('connect', onConnect);
    socket.on('ROOM_UPDATE', onRoomUpdate);
    socket.on('RUN_STARTED', onRunStarted);
    socket.on('PHASE_CHANGED', onPhaseChanged);
    socket.on('RUN_ENDED', onRunEnded);
    return () => {
      socket.off('connect', onConnect);
      socket.off('ROOM_UPDATE', onRoomUpdate);
      socket.off('RUN_STARTED', onRunStarted);
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
    function tick() {
      const socket = socketRef.current;
      if (socket && held.size > 0) {
        let dx = 0, dy = 0;
        if (held.has('w') || held.has('arrowup'))    dy -= 1;
        if (held.has('s') || held.has('arrowdown'))  dy += 1;
        if (held.has('a') || held.has('arrowleft'))  dx -= 1;
        if (held.has('d') || held.has('arrowright')) dx += 1;
        if (dx !== 0 || dy !== 0) {
          const mag = Math.sqrt(dx * dx + dy * dy);
          socket.emit('move-player', { dx: dx / mag, dy: dy / mag });
        }
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
      {screen === 'lobby' && <LobbyScreen socketRef={socketRef} />}

      {screen === 'waiting' && roomSummary && (
        <WaitingRoom socketRef={socketRef} room={roomSummary} localPlayerId={localPlayerId} />
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
          onReturnToLobby={() => { setScreen('lobby'); setRunEndData(null); }}
        />
      )}
    </div>
  );
}
