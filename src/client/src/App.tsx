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
import type { GamePhase, RoomSummary, RelicBoard, SynergyMap, Relic, RoomUpdateEvent, DungeonLayout, StateResyncEvent, EnemyTypeId } from '@veins/shared';

type InitialEnemy = { enemyId: string; typeId: EnemyTypeId; x: number; y: number; hp: number };

type Emitter = { emit: (event: string, payload: unknown) => void };

// Desktop aim: point the player toward the mouse cursor. Computes the aim vector
// from the cursor's world position relative to the local player and emits it.
// Recomputed continuously (on mouse move AND while strafing) so aim stays locked
// to the cursor as the player moves — no auto-revert to auto-aim (that's mobile).
function emitAim(socket: Emitter, clientX: number, clientY: number): void {
  const { camera, localPlayerPos } = sceneStore;
  let dx: number, dy: number;
  if (camera && localPlayerPos) {
    const world = camera.getWorldPoint(clientX, clientY);
    dx = world.x - localPlayerPos.x;
    dy = world.y - localPlayerPos.y;
  } else {
    dx = clientX - window.innerWidth / 2;
    dy = clientY - window.innerHeight / 2;
  }
  socket.emit('aim-player', { dx, dy });
}

// True on devices with a precise pointer (mouse/trackpad) — i.e. desktop. Used to
// scope hold-to-fire + manual mouse-aim to desktop, leaving mobile on auto-fire.
function hasFinePointer(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(pointer: fine)').matches;
}

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
  lootPools: Record<string, string[]>;
  dungeon: DungeonLayout;
  playerPositions: Record<string, { x: number; y: number }>;
  enemies: InitialEnemy[];
  // Players who are downed at snapshot time — so a resync re-greys them (R6).
  downedPlayers?: string[];
};

type RunEndData = { outcome: 'wiped' | 'extracted'; finalFloor: number; enemiesKilled: number };

export function App() {
  const socketRef = useSocket();
  const gameRef = useRef<Phaser.Game | null>(null);
  // Tracks whether the game screen is active, so the global mouse/keyboard input
  // listeners only emit gameplay events while in a run — never from the lobby.
  const inGameRef = useRef(false);
  // True between emitting a `rejoin` and its resolution, so a LOBBY_ERROR for a
  // stale/wiped room code can be told apart from a manual join failure.
  const pendingRejoinRef = useRef(false);
  // Latest mouse cursor position (client coords), so aim can be recomputed while
  // the player strafes (the player→cursor vector changes even if the mouse is still).
  const lastMouseRef = useRef<{ x: number; y: number } | null>(null);

  const [screen, setScreen] = useState<Screen>('lobby');
  const [roomSummary, setRoomSummary] = useState<RoomSummary | null>(null);
  const [runData, setRunData] = useState<RunData | null>(null);
  const [runEndData, setRunEndData] = useState<RunEndData | null>(null);
  const [phase, setPhase] = useState<GamePhase>('loot');
  const [localPlayerId] = useState<string>(() => getStablePlayerId());
  const [connected, setConnected] = useState<boolean>(false);

  // Derived — no extra state.
  const players = roomSummary?.players ?? [];

  // Keep the in-game flag in sync for the global input listeners (below).
  useEffect(() => { inGameRef.current = screen === 'game'; }, [screen]);

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
    game.registry.set('initialEnemies', runData?.enemies ?? null);
    game.registry.set('initialDownedPlayers', runData?.downedPlayers ?? null);

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
      if (code) {
        pendingRejoinRef.current = true;
        socket!.emit('rejoin', { code });
      }
    }
    if (socket.connected) attemptRejoin();

    function onConnect() { setConnected(true); attemptRejoin(); }
    function onDisconnect() { setConnected(false); }

    // P2: read ev.room (RoomUpdateEvent shape) — not ev directly.
    function onRoomUpdate(ev: RoomUpdateEvent) {
      pendingRejoinRef.current = false;
      setRoomSummary(ev.room);
      rememberRoomCode(ev.room.code);
      setScreen('waiting');
    }

    // A rejoin we asked for failed (e.g. the room was wiped by a server restart, or
    // it is a lobby room that does not support rejoin). Drop the stale code and
    // return to the lobby instead of stranding the user on a dead room. A manual
    // join failure (no pending rejoin) is left for LobbyScreen to surface.
    function onLobbyError() {
      if (!pendingRejoinRef.current) return;
      pendingRejoinRef.current = false;
      forgetRoomCode();
      setRoomSummary(null);
      setScreen('lobby');
    }

    // P1: capture payload so BoardPanel has initial state on first render.
    function onRunStarted(ev: RunData & { phase?: GamePhase }) {
      setRunData(ev);
      setPhase(ev.phase ?? 'combat');
      setScreen('game');
    }

    // Reconnection: rebuild render state from the full snapshot and re-enter the game (R6).
    function onStateResync(ev: StateResyncEvent) {
      pendingRejoinRef.current = false;
      setRoomSummary(ev.room);
      rememberRoomCode(ev.room.code);
      setRunData({
        board: ev.board,
        synergyMap: ev.synergyMap,
        relicRegistry: ev.relicRegistry,
        lootPools: ev.lootPools,
        dungeon: ev.dungeon as DungeonLayout, // an in-progress resync always carries a dungeon
        playerPositions: Object.fromEntries(
          Object.entries(ev.playerStates).map(([id, s]) => [id, { x: s.x, y: s.y }])
        ),
        enemies: ev.enemies, // rehydrate enemy sprites on reconnect (closes the resync follow-up)
        downedPlayers: Object.entries(ev.playerStates).filter(([, s]) => s.downed).map(([id]) => id),
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
    socket.on('LOBBY_ERROR', onLobbyError);
    socket.on('RUN_STARTED', onRunStarted);
    socket.on('STATE_RESYNC', onStateResync);
    socket.on('PHASE_CHANGED', onPhaseChanged);
    socket.on('RUN_ENDED', onRunEnded);
    return () => {
      socket.off('connect', onConnect);
      socket.off('LOBBY_ERROR', onLobbyError);
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
      if (socket && inGameRef.current) {
        let dx = 0, dy = 0;
        if (held.has('w') || held.has('arrowup'))    dy -= 1;
        if (held.has('s') || held.has('arrowdown'))  dy += 1;
        if (held.has('a') || held.has('arrowleft'))  dx -= 1;
        if (held.has('d') || held.has('arrowright')) dx += 1;
        const moving = dx !== 0 || dy !== 0;
        if (moving) {
          const mag = Math.sqrt(dx * dx + dy * dy);
          socket.emit('move-player', { dx: dx / mag, dy: dy / mag });
          // Keep aim locked to the cursor while strafing (player→cursor changes
          // as the player moves, even with a stationary mouse).
          if (lastMouseRef.current) emitAim(socket, lastMouseRef.current.x, lastMouseRef.current.y);
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

  // Mouse-aim (desktop): point toward the cursor while in a run. Sticky — no
  // auto-revert to auto-aim; the cursor always dictates aim (mobile uses the
  // joystick + auto-aim instead).
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
      const socket = socketRef.current;
      if (!socket || !inGameRef.current) return;
      emitAim(socket, e.clientX, e.clientY);
    }
    window.addEventListener('mousemove', onMouseMove);
    return () => window.removeEventListener('mousemove', onMouseMove);
  }, [socketRef]);

  // Hold-to-fire (desktop only): opt out of auto-fire on game entry, then fire
  // while the left mouse button is held. Mobile never runs this, so it keeps
  // auto-fire. The server still rate-limits by the weapon cooldown.
  useEffect(() => {
    if (screen !== 'game' || !hasFinePointer()) return;

    const emitFiring = (firing: boolean) => socketRef.current?.emit('set-firing', { firing });
    emitFiring(false); // opt out of auto-fire; the mouse button drives firing now

    function onDown(e: MouseEvent) { if (e.button === 0) emitFiring(true); }
    function onUp(e: MouseEvent) { if (e.button === 0) emitFiring(false); }
    function stopFiring() { emitFiring(false); }

    window.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('blur', stopFiring);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('blur', stopFiring);
    };
  }, [screen, socketRef]);

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
        <WaitingRoom
          socketRef={socketRef}
          room={roomSummary}
          localPlayerId={localPlayerId}
          connected={connected}
          onLeave={() => { setScreen('lobby'); setRoomSummary(null); forgetRoomCode(); }}
        />
      )}

      {screen === 'game' && (
        <>
          <div id="game-container" style={{ width: '100%', height: '100%' }} />
          {/* The joystick is a full-screen, fixed (inset:0) touch overlay, so it
              MUST render before the interactive panels below. With no z-index in
              play, paint order = DOM order: rendered last, it would sit on top of
              the board/descend panels and swallow every click/tap (the board
              "can't be interacted with" bug). Placed first, it stays behind the
              panels — they get their own clicks while it still catches touches on
              the empty game area for mobile move/aim. */}
          <VirtualJoystick onMove={handleMove} onAim={handleAim} />
          <HUD socketRef={socketRef} localPlayerId={localPlayerId} players={players} />
          <BoardPanel
            socketRef={socketRef}
            localPlayerId={localPlayerId}
            phase={phase}
            players={players}
            initialBoard={runData?.board}
            initialSynergyMap={runData?.synergyMap}
            initialRegistry={runData?.relicRegistry}
            initialLootPool={runData?.lootPools?.[localPlayerId]}
          />
          <DescendPanel socketRef={socketRef} phase={phase} />
          <PhaseToast socketRef={socketRef} />
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
