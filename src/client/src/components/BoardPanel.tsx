import { useState, useEffect, useCallback } from 'react';
import type { RefObject } from 'react';
import type { Socket } from 'socket.io-client';
import type { RelicBoard, SynergyMap, Relic, GamePhase, HexCoord, RelicSlot } from '@veins/shared';
import { hexCoordKey } from '@veins/shared';

const SYNERGY_STYLE_ID = 'synergy-pulse-style';
const SYNERGY_CSS = `
@keyframes synergy-pulse {
  0%,100% { filter: drop-shadow(0 0 4px #ffff00); }
  50%      { filter: drop-shadow(0 0 14px #ffff00); }
}
.synergized { animation: synergy-pulse 1.5s ease-in-out infinite; }
`;

const HEX_SIZE = 38;
const SQRT3 = Math.sqrt(3);

function hexToPixel(q: number, r: number): { x: number; y: number } {
  return {
    x: HEX_SIZE * (1.5 * q),
    y: HEX_SIZE * (SQRT3 / 2 * q + SQRT3 * r),
  };
}

function hexPoints(cx: number, cy: number): string {
  return [0, 60, 120, 180, 240, 300]
    .map(deg => {
      const rad = (Math.PI / 180) * deg;
      return `${(cx + HEX_SIZE * Math.cos(rad)).toFixed(2)},${(cy + HEX_SIZE * Math.sin(rad)).toFixed(2)}`;
    })
    .join(' ');
}

const OWNER_COLORS = ['#4488ff', '#ff8844', '#44cc44', '#cc44ff'];

function ownerColor(ownerId: string, localId: string, players: string[]): string {
  if (ownerId === localId) return OWNER_COLORS[0]!;
  const others = players.filter(p => p !== localId);
  const idx = others.indexOf(ownerId);
  return OWNER_COLORS[idx + 1] ?? '#888888';
}

type Props = {
  socketRef: RefObject<Socket | null>;
  localPlayerId: string;
  phase: GamePhase;
  players: string[];
  initialBoard?: RelicBoard;
  initialSynergyMap?: SynergyMap;
  initialRegistry?: Record<string, Relic>;
  initialLootPool?: string[];
};

type BoardState = {
  board: RelicBoard;
  synergyMap: SynergyMap;
  registry: Record<string, Relic>;
  lootPool: string[];
};

type ReviveState =
  | { active: false }
  | { active: true; downedId: string; step: 'select-source'; error: string | null }
  | { active: true; downedId: string; step: 'select-target'; sourceCoord: HexCoord; error: string | null };

export function BoardPanel({ socketRef, localPlayerId, phase, players, initialBoard, initialSynergyMap, initialRegistry, initialLootPool }: Props) {
  const [state, setState] = useState<BoardState>({
    board: initialBoard ?? { slots: {} },
    synergyMap: initialSynergyMap ?? {},
    registry: initialRegistry ?? {},
    lootPool: initialLootPool ?? [],
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [revive, setRevive] = useState<ReviveState>({ active: false });
  const [placementError, setPlacementError] = useState<string | null>(null);
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    const el = document.createElement('style');
    el.id = SYNERGY_STYLE_ID;
    el.textContent = SYNERGY_CSS;
    document.head.appendChild(el);
    return () => { document.getElementById(SYNERGY_STYLE_ID)?.remove(); };
  }, []);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    function onRunStarted(ev: { board: RelicBoard; synergyMap: SynergyMap; relicRegistry: Record<string, Relic>; lootPool?: string[] }) {
      setState({ board: ev.board, synergyMap: ev.synergyMap, registry: ev.relicRegistry, lootPool: ev.lootPool ?? [] });
      setSelected(null);
    }

    function onBoardSync(ev: { board: RelicBoard; synergyMap: SynergyMap; relicRegistry: Record<string, Relic>; lootPool?: string[] }) {
      setState({ board: ev.board, synergyMap: ev.synergyMap, registry: ev.relicRegistry, lootPool: ev.lootPool ?? [] });
      setSelected(null);
    }

    function onRelicPlaced(ev: { coord: HexCoord; relicId: string; synergyMap: SynergyMap }) {
      setPlacementError(null);
      setState(prev => {
        const key = hexCoordKey(ev.coord);
        const slots = { ...prev.board.slots };
        const slot = slots[key];
        if (slot) slots[key] = { ...slot, relicId: ev.relicId };
        return {
          ...prev,
          board: { slots },
          synergyMap: ev.synergyMap,
          lootPool: prev.lootPool.filter(id => id !== ev.relicId),
        };
      });
    }

    function onPhaseChanged(ev: { phase: GamePhase; lootPool?: string[] }) {
      if (ev.lootPool) setState(prev => ({ ...prev, lootPool: ev.lootPool! }));
    }

    function onRelicPlaceError(ev: { code: string; message: string }) {
      setPlacementError(ev.message);
    }

    function onRelicRemoved(ev: { coord: HexCoord; relicId: string; reason: string }) {
      setState(prev => {
        const key = hexCoordKey(ev.coord);
        const slots = { ...prev.board.slots };
        const slot = slots[key];
        if (slot) slots[key] = { ...slot, relicId: null };
        return { ...prev, board: { slots } };
      });
    }

    function onPlayerDowned(ev: { playerId: string }) {
      if (ev.playerId === localPlayerId) return;
      setRevive({ active: true, downedId: ev.playerId, step: 'select-source', error: null });
    }

    function onPlayerRevived(ev: { playerId: string }) {
      setRevive(prev => (prev.active && prev.downedId === ev.playerId) ? { active: false } : prev);
    }

    function onLinkedFatesError(ev: { message: string }) {
      setRevive(prev => prev.active ? { ...prev, error: ev.message } : prev);
    }

    socket.on('RUN_STARTED', onRunStarted);
    socket.on('BOARD_STATE_SYNC', onBoardSync);
    socket.on('RELIC_PLACED', onRelicPlaced);
    socket.on('RELIC_PLACE_ERROR', onRelicPlaceError);
    socket.on('PHASE_CHANGED', onPhaseChanged);
    socket.on('RELIC_REMOVED', onRelicRemoved);
    socket.on('PLAYER_DOWNED', onPlayerDowned);
    socket.on('PLAYER_REVIVED', onPlayerRevived);
    socket.on('LINKED_FATES_ERROR', onLinkedFatesError);
    return () => {
      socket.off('RUN_STARTED', onRunStarted);
      socket.off('BOARD_STATE_SYNC', onBoardSync);
      socket.off('RELIC_PLACED', onRelicPlaced);
      socket.off('RELIC_PLACE_ERROR', onRelicPlaceError);
      socket.off('PHASE_CHANGED', onPhaseChanged);
      socket.off('RELIC_REMOVED', onRelicRemoved);
      socket.off('PLAYER_DOWNED', onPlayerDowned);
      socket.off('PLAYER_REVIVED', onPlayerRevived);
      socket.off('LINKED_FATES_ERROR', onLinkedFatesError);
    };
  }, [socketRef, localPlayerId]);

  const handleSlotClick = useCallback((slot: RelicSlot) => {
    if (revive.active) {
      if (revive.step === 'select-source') {
        if (slot.ownerId !== localPlayerId || !slot.relicId) return;
        setRevive({ ...revive, step: 'select-target', sourceCoord: slot.coord, error: null });
        return;
      }
      if (revive.step === 'select-target') {
        if (slot.ownerId !== revive.downedId || slot.relicId !== null) return;
        socketRef.current?.emit('revive', { sourceCoord: revive.sourceCoord, targetCoord: slot.coord });
        setRevive({ active: false });
        return;
      }
    }
    if (!selected) return;
    if (slot.ownerId !== localPlayerId) return;
    if (slot.relicId !== null) return;
    setPlacementError(null);
    socketRef.current?.emit('place-relic', { coord: slot.coord, relicId: selected });
    setSelected(null);
  }, [revive, selected, localPlayerId, socketRef]);

  if (phase !== 'loot' && !revive.active) return null;

  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        style={{
          position: 'absolute',
          bottom: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '6px 16px',
          background: 'rgba(0,0,0,0.8)',
          color: '#ffff88',
          border: '1px solid #555',
          borderRadius: '8px',
          fontSize: '12px',
          cursor: 'pointer',
          pointerEvents: 'auto',
        }}
      >
        {revive.active ? '⚠ Revive' : '▲ Relic Board'}
      </button>
    );
  }

  const { board, synergyMap, registry, lootPool } = state;
  const placedIds = new Set(
    Object.values(board.slots).map(s => s.relicId).filter((id): id is string => id !== null)
  );
  const available = lootPool
    .map(id => registry[id])
    .filter((r): r is Relic => r !== undefined && !placedIds.has(r.id));

  return (
    <div
      data-testid="board-panel"
      style={{
        position: 'absolute',
        bottom: '80px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        pointerEvents: 'auto',
        background: 'rgba(0,0,0,0.75)',
        borderRadius: '12px',
        padding: '12px',
        userSelect: 'none',
      }}
    >
      <button
        onClick={() => setMinimized(true)}
        style={{
          position: 'absolute',
          top: '6px',
          right: '8px',
          background: 'transparent',
          border: 'none',
          color: '#888',
          fontSize: '14px',
          cursor: 'pointer',
          lineHeight: 1,
          padding: '2px 4px',
        }}
        title="Minimize board"
      >
        ▼
      </button>
      {revive.active && (
        <div data-testid="revive-panel" style={{ textAlign: 'center', color: '#fff', fontSize: '13px' }}>
          {revive.step === 'select-source' && (
            <button
              data-testid="revive-btn"
              onClick={() => setRevive({ ...revive })}
              style={{ cursor: 'default', background: 'transparent', border: 'none', color: '#ffcc00', fontSize: '13px', fontWeight: 'bold' }}
            >
              Revive teammate — pick a relic to sacrifice
            </button>
          )}
          {revive.step === 'select-target' && (
            <span data-testid="revive-target-hint">Now pick a slot on their board</span>
          )}
          {revive.error && (
            <div data-testid="linked-fates-error" style={{ color: '#ff5555', marginTop: '4px' }}>
              {revive.error}
            </div>
          )}
        </div>
      )}

      <svg width="320" height="320" viewBox="-160 -160 320 320">
        {Object.entries(board.slots).map(([key, slot]) => {
          const { x: px, y: py } = hexToPixel(slot.coord.q, slot.coord.r);
          const fill = ownerColor(slot.ownerId, localPlayerId, players);
          const synergized = slot.relicId !== null && synergyMap[slot.relicId] === true;
          const isReviveSource = revive.active && revive.step === 'select-source'
            && slot.ownerId === localPlayerId && slot.relicId !== null;
          const isReviveTarget = revive.active && revive.step === 'select-target'
            && slot.ownerId === revive.downedId && slot.relicId === null;
          // Highlight empty owned slots when the player has a relic selected.
          const isPlacementTarget = !!selected && slot.ownerId === localPlayerId && slot.relicId === null;
          return (
            <g
              key={key}
              className={synergized ? 'synergized' : undefined}
              data-synergized={synergized ? 'true' : undefined}
              data-revive-source={isReviveSource ? 'true' : undefined}
              data-revive-target={isReviveTarget ? 'true' : undefined}
              onClick={() => handleSlotClick(slot)}
              style={{ cursor: 'pointer' }}
            >
              <polygon
                points={hexPoints(px, py)}
                fill={fill}
                stroke={isReviveSource ? '#00ffaa' : isReviveTarget ? '#ffaa00' : isPlacementTarget ? '#ffffff' : synergized ? '#ffff00' : '#555555'}
                strokeWidth={isReviveSource || isReviveTarget ? 3 : isPlacementTarget ? 2 : synergized ? 3 : 1}
                opacity={slot.relicId ? 0.9 : isPlacementTarget ? 0.8 : 0.5}
              />
              {slot.relicId && registry[slot.relicId] && (
                <text
                  x={px}
                  y={py}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#ffffff"
                  fontSize="8"
                  style={{ pointerEvents: 'none' }}
                >
                  {registry[slot.relicId]!.name}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {phase === 'loot' && (
        <div
          data-testid="relic-tray"
          style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center', maxWidth: '320px' }}
        >
          {available.length === 0 ? (
            <div
              data-testid="tray-ready-hint"
              style={{ color: '#88ff88', fontSize: '12px', fontFamily: 'monospace', padding: '4px 0' }}
            >
              All relics placed — ready to descend!
            </div>
          ) : (
            <>
              <div style={{ color: '#aaa', fontSize: '11px', fontFamily: 'monospace' }}>
                {selected
                  ? '→ Now click one of your colored slots on the board above'
                  : '↓ Click a relic to select it, then click your slot on the board'}
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
                {available.map(relic => (
                  <button
                    key={relic.id}
                    data-testid={`relic-card-${relic.id}`}
                    data-selected={selected === relic.id ? 'true' : 'false'}
                    onClick={() => setSelected(s => s === relic.id ? null : relic.id)}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      background: selected === relic.id ? '#333' : '#1a1a1a',
                      color: '#fff',
                      border: selected === relic.id ? '2px solid #ffff00' : '2px solid #555',
                      borderRadius: '4px',
                    }}
                  >
                    {relic.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {placementError && (
        <div
          data-testid="placement-error"
          style={{ color: '#ff5555', fontSize: '11px', fontFamily: 'monospace', maxWidth: '300px', textAlign: 'center' }}
        >
          {placementError}
        </div>
      )}

      {phase === 'loot' && selected && registry[selected] && (() => {
        const r = registry[selected]!;
        return (
          <div
            data-testid="relic-detail"
            style={{
              maxWidth: '300px',
              background: 'rgba(0,0,0,0.6)',
              border: '1px solid #444',
              borderRadius: '6px',
              padding: '8px 10px',
              fontSize: '11px',
              color: '#ccc',
              lineHeight: '1.5',
            }}
          >
            <div style={{ color: '#fff', fontWeight: 'bold', marginBottom: '4px' }}>
              {r.name}
              <span style={{ color: '#888', fontWeight: 'normal', marginLeft: '6px' }}>
                [{r.tags.join(', ')}]
              </span>
            </div>
            <div data-testid="relic-detail-base">
              Base: {r.baseEffect.description}
            </div>
            <div data-testid="relic-detail-synergy" style={{ color: '#ffff88', marginTop: '2px' }}>
              Synergy: {r.synergyEffect.description}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
