// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { RefObject } from 'react';
import { BoardPanel } from './BoardPanel.js';
import type { RelicBoard, Relic, SynergyMap } from '@veins/shared';

// Minimal socket stub.
function makeSocket() {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  const emits: Array<{ event: string; payload: unknown }> = [];
  return {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers.set(event, handler);
    }),
    off: vi.fn(),
    emit: vi.fn((event: string, payload: unknown) => {
      emits.push({ event, payload });
    }),
    handlers,
    emits,
  };
}

type FakeSocket = ReturnType<typeof makeSocket>;

function makeRef(socket: FakeSocket): RefObject<FakeSocket> {
  return { current: socket } as unknown as RefObject<FakeSocket>;
}

// Two-player flat board: 3 slots total, player1 owns 2, player2 owns 1.
function makeBoard(localId: string, remoteId: string): RelicBoard {
  return {
    slots: {
      '0,0': { coord: { q: 0, r: 0 }, ownerId: localId, relicId: null },
      '1,0': { coord: { q: 1, r: 0 }, ownerId: localId, relicId: null },
      '-1,0': { coord: { q: -1, r: 0 }, ownerId: remoteId, relicId: null },
    },
  };
}

const RELIC_A: Relic = {
  id: 'ember-core',
  name: 'Ember Core',
  tags: ['fire', 'aoe'],
  baseEffect: { description: 'Attacks deal +5 damage.' },
  synergyEffect: { description: 'Attacks explode on hit.' },
};
const RELIC_B: Relic = {
  id: 'torch-brand',
  name: 'Torch Brand',
  tags: ['fire'],
  baseEffect: { description: 'Sets enemies on fire.' },
  synergyEffect: { description: 'Fire spreads to adjacent enemies.' },
};

const REGISTRY: Record<string, Relic> = {
  'ember-core': RELIC_A,
  'torch-brand': RELIC_B,
};

const LOCAL_ID = 'player-local';
const REMOTE_ID = 'player-remote';
const PLAYERS = [LOCAL_ID, REMOTE_ID];

describe('BoardPanel visibility (T3, R4)', () => {
  it('is collapsed (not expanded) during combat, but offers a Relic Board button to peek', () => {
    const socket = makeSocket();
    const ref = makeRef(socket);
    render(
      <BoardPanel
        socketRef={ref as never}
        localPlayerId={LOCAL_ID}
        phase="combat"
        players={PLAYERS}
      />
    );
    // Expanded board is hidden during combat...
    expect(screen.queryByTestId('board-panel')).toBeNull();
    // ...but a collapsed button lets the player expand it to view their build.
    expect(screen.getByTestId('board-minimized-btn')).toBeTruthy();
  });

  it('expands to a view-only board when the combat button is clicked', () => {
    const socket = makeSocket();
    const ref = makeRef(socket);
    render(
      <BoardPanel
        socketRef={ref as never}
        localPlayerId={LOCAL_ID}
        phase="combat"
        players={PLAYERS}
        initialBoard={makeBoard(LOCAL_ID, REMOTE_ID)}
        initialRegistry={REGISTRY}
      />
    );
    fireEvent.click(screen.getByTestId('board-minimized-btn'));
    expect(screen.getByTestId('board-panel')).toBeTruthy();
    expect(screen.getByTestId('board-viewonly-hint')).toBeTruthy();
    // No relic tray outside loot — placement is loot-only.
    expect(screen.queryByTestId('relic-tray')).toBeNull();
  });

  it('is expanded automatically when phase === loot', () => {
    const socket = makeSocket();
    const ref = makeRef(socket);
    render(
      <BoardPanel
        socketRef={ref as never}
        localPlayerId={LOCAL_ID}
        phase="loot"
        players={PLAYERS}
      />
    );
    expect(screen.getByTestId('board-panel')).toBeTruthy();
    expect(screen.queryByTestId('board-viewonly-hint')).toBeNull();
  });

  it('auto-expands when the phase transitions combat → loot', () => {
    const socket = makeSocket();
    const ref = makeRef(socket);
    const { rerender } = render(
      <BoardPanel socketRef={ref as never} localPlayerId={LOCAL_ID} phase="combat" players={PLAYERS} />
    );
    expect(screen.queryByTestId('board-panel')).toBeNull();
    rerender(
      <BoardPanel socketRef={ref as never} localPlayerId={LOCAL_ID} phase="loot" players={PLAYERS} />
    );
    expect(screen.getByTestId('board-panel')).toBeTruthy();
  });

  // Full real-flow regression for per-player pools: run starts in combat with
  // EMPTY pools (as the server sends), the floor clears → PHASE_CHANGED delivers
  // this player's pool, the tray appears, and clicking an owned slot places it.
  it('combat start (empty pool) → PHASE_CHANGED delivers the pool → can place a relic', async () => {
    const socket = makeSocket();
    const ref = makeRef(socket);
    const { rerender } = render(
      <BoardPanel socketRef={ref as never} localPlayerId={LOCAL_ID} phase="combat" players={PLAYERS} />
    );

    // Run starts in combat: server sends empty per-player pools.
    await act(async () => {
      socket.handlers.get('RUN_STARTED')!({
        board: makeBoard(LOCAL_ID, REMOTE_ID),
        synergyMap: {},
        relicRegistry: REGISTRY,
        lootPools: {},
      });
    });
    expect(screen.queryByTestId('relic-tray')).toBeNull(); // no tray during combat

    // Floor cleared → loot phase with this player's pool.
    await act(async () => {
      socket.handlers.get('PHASE_CHANGED')!({ phase: 'loot', lootPools: { [LOCAL_ID]: LOOT_POOL } });
    });
    rerender(
      <BoardPanel socketRef={ref as never} localPlayerId={LOCAL_ID} phase="loot" players={PLAYERS} />
    );

    // Tray now shows the player's relics; select one and place it on an owned slot.
    expect(screen.getByTestId('relic-card-ember-core')).toBeTruthy();
    fireEvent.click(screen.getByTestId('relic-card-ember-core'));
    const localGroup = Array.from(document.querySelectorAll('svg g')).find(
      g => g.querySelector('polygon')?.getAttribute('fill') === '#4488ff'
    );
    fireEvent.click(localGroup!);

    const emitted = socket.emits.find(e => e.event === 'place-relic');
    expect(emitted).toBeDefined();
    expect((emitted!.payload as { relicId: string }).relicId).toBe('ember-core');
  });
});

describe('BoardPanel hex grid (T3, R4)', () => {
  it('renders one polygon per slot after RUN_STARTED', async () => {
    const socket = makeSocket();
    const ref = makeRef(socket);
    render(
      <BoardPanel
        socketRef={ref as never}
        localPlayerId={LOCAL_ID}
        phase="loot"
        players={PLAYERS}
      />
    );

    const board = makeBoard(LOCAL_ID, REMOTE_ID);
    await act(async () => {
      socket.handlers.get('RUN_STARTED')!({
        board,
        synergyMap: {},
        relicRegistry: REGISTRY,
      });
    });

    const polygons = document.querySelectorAll('polygon');
    expect(polygons.length).toBe(3);
  });

  it('local-player slot gets fill #4488ff', async () => {
    const socket = makeSocket();
    const ref = makeRef(socket);
    render(
      <BoardPanel
        socketRef={ref as never}
        localPlayerId={LOCAL_ID}
        phase="loot"
        players={PLAYERS}
      />
    );

    const board = makeBoard(LOCAL_ID, REMOTE_ID);
    await act(async () => {
      socket.handlers.get('RUN_STARTED')!({
        board,
        synergyMap: {},
        relicRegistry: {},
      });
    });

    const polygons = Array.from(document.querySelectorAll('polygon'));
    const localPolygons = polygons.filter(p => p.getAttribute('fill') === '#4488ff');
    // 2 of 3 slots owned by LOCAL_ID
    expect(localPolygons.length).toBe(2);
  });

  it('a synergized slot gets a yellow stroke', async () => {
    const socket = makeSocket();
    const ref = makeRef(socket);
    render(
      <BoardPanel
        socketRef={ref as never}
        localPlayerId={LOCAL_ID}
        phase="loot"
        players={PLAYERS}
      />
    );

    const board: RelicBoard = {
      slots: {
        '0,0': { coord: { q: 0, r: 0 }, ownerId: LOCAL_ID, relicId: 'ember-core' },
        '1,0': { coord: { q: 1, r: 0 }, ownerId: REMOTE_ID, relicId: null },
      },
    };
    const synergyMap: SynergyMap = { 'ember-core': true };
    await act(async () => {
      socket.handlers.get('RUN_STARTED')!({
        board,
        synergyMap,
        relicRegistry: REGISTRY,
      });
    });

    const polygons = Array.from(document.querySelectorAll('polygon'));
    const yellow = polygons.find(p => p.getAttribute('stroke') === '#ffff00');
    expect(yellow).toBeTruthy();
    expect(yellow?.getAttribute('stroke-width')).toBe('3');
  });

  it('placed relic name appears inside its slot as svg text', async () => {
    const socket = makeSocket();
    const ref = makeRef(socket);
    render(
      <BoardPanel
        socketRef={ref as never}
        localPlayerId={LOCAL_ID}
        phase="loot"
        players={PLAYERS}
      />
    );

    const board: RelicBoard = {
      slots: {
        '0,0': { coord: { q: 0, r: 0 }, ownerId: LOCAL_ID, relicId: 'ember-core' },
      },
    };
    await act(async () => {
      socket.handlers.get('RUN_STARTED')!({
        board,
        synergyMap: {},
        relicRegistry: REGISTRY,
      });
    });

    expect(screen.getByText('Ember Core')).toBeTruthy();
  });
});

const LOOT_POOL = ['ember-core', 'torch-brand'];

describe('BoardPanel relic tray (T3, R5)', () => {
  it('shows only lootPool relics as buttons in the tray (T3-loot, R5)', async () => {
    const socket = makeSocket();
    const ref = makeRef(socket);
    render(
      <BoardPanel
        socketRef={ref as never}
        localPlayerId={LOCAL_ID}
        phase="loot"
        players={PLAYERS}
      />
    );

    const board = makeBoard(LOCAL_ID, REMOTE_ID);
    await act(async () => {
      socket.handlers.get('RUN_STARTED')!({
        board,
        synergyMap: {},
        relicRegistry: REGISTRY,
        lootPools: { [LOCAL_ID]: LOOT_POOL },
      });
    });

    expect(screen.getByTestId('relic-card-ember-core')).toBeTruthy();
    expect(screen.getByTestId('relic-card-torch-brand')).toBeTruthy();
  });

  it('tray is empty when lootPool is empty (T3-loot, R5)', async () => {
    const socket = makeSocket();
    const ref = makeRef(socket);
    render(
      <BoardPanel
        socketRef={ref as never}
        localPlayerId={LOCAL_ID}
        phase="loot"
        players={PLAYERS}
      />
    );

    await act(async () => {
      socket.handlers.get('RUN_STARTED')!({
        board: makeBoard(LOCAL_ID, REMOTE_ID),
        synergyMap: {},
        relicRegistry: REGISTRY,
        lootPools: {},
      });
    });

    expect(screen.queryByTestId('relic-card-ember-core')).toBeNull();
    expect(screen.queryByTestId('relic-card-torch-brand')).toBeNull();
  });

  it('tray updates when PHASE_CHANGED carries a new lootPool (T3-loot, R5)', async () => {
    const socket = makeSocket();
    const ref = makeRef(socket);
    render(
      <BoardPanel
        socketRef={ref as never}
        localPlayerId={LOCAL_ID}
        phase="loot"
        players={PLAYERS}
      />
    );

    await act(async () => {
      socket.handlers.get('RUN_STARTED')!({
        board: makeBoard(LOCAL_ID, REMOTE_ID),
        synergyMap: {},
        relicRegistry: REGISTRY,
        lootPools: {},
      });
    });
    expect(screen.queryByTestId('relic-card-ember-core')).toBeNull();

    await act(async () => {
      socket.handlers.get('PHASE_CHANGED')!({ phase: 'loot', lootPools: { [LOCAL_ID]: ['ember-core'] } });
    });
    expect(screen.getByTestId('relic-card-ember-core')).toBeTruthy();
    expect(screen.queryByTestId('relic-card-torch-brand')).toBeNull();
  });

  it("a teammate's RELIC_PLACED does not remove the relic from the local tray (per-player pools)", async () => {
    const socket = makeSocket();
    const ref = makeRef(socket);
    render(
      <BoardPanel
        socketRef={ref as never}
        localPlayerId={LOCAL_ID}
        phase="loot"
        players={PLAYERS}
      />
    );

    await act(async () => {
      socket.handlers.get('RUN_STARTED')!({
        board: makeBoard(LOCAL_ID, REMOTE_ID),
        synergyMap: {},
        relicRegistry: REGISTRY,
        lootPools: { [LOCAL_ID]: LOOT_POOL },
      });
      // The REMOTE player places ember-core on their own slot.
      socket.handlers.get('RELIC_PLACED')!({
        coord: { q: -1, r: 0 }, relicId: 'ember-core', ownerId: REMOTE_ID, synergyMap: {},
      });
    });

    // Local player's pool is untouched — ember-core is still offered to them.
    expect(screen.getByTestId('relic-card-ember-core')).toBeTruthy();
  });

  it('clicking a relic card selects it (data-selected becomes true)', async () => {
    const socket = makeSocket();
    const ref = makeRef(socket);
    render(
      <BoardPanel
        socketRef={ref as never}
        localPlayerId={LOCAL_ID}
        phase="loot"
        players={PLAYERS}
      />
    );

    const board = makeBoard(LOCAL_ID, REMOTE_ID);
    await act(async () => {
      socket.handlers.get('RUN_STARTED')!({
        board,
        synergyMap: {},
        relicRegistry: REGISTRY,
        lootPools: { [LOCAL_ID]: LOOT_POOL },
      });
    });

    const card = screen.getByTestId('relic-card-ember-core');
    fireEvent.click(card);
    expect(card.getAttribute('data-selected')).toBe('true');
  });

  it('clicking the same card again deselects it', async () => {
    const socket = makeSocket();
    const ref = makeRef(socket);
    render(
      <BoardPanel
        socketRef={ref as never}
        localPlayerId={LOCAL_ID}
        phase="loot"
        players={PLAYERS}
      />
    );

    const board = makeBoard(LOCAL_ID, REMOTE_ID);
    await act(async () => {
      socket.handlers.get('RUN_STARTED')!({
        board,
        synergyMap: {},
        relicRegistry: REGISTRY,
        lootPools: { [LOCAL_ID]: LOOT_POOL },
      });
    });

    const card = screen.getByTestId('relic-card-ember-core');
    fireEvent.click(card);
    fireEvent.click(card);
    expect(card.getAttribute('data-selected')).toBe('false');
  });
});

describe('BoardPanel place-relic flow (T3, R6, R7)', () => {
  it('clicking an OCCUPIED owned slot with a selected relic emits place-relic (replacement)', async () => {
    const socket = makeSocket();
    const ref = makeRef(socket);
    render(
      <BoardPanel socketRef={ref as never} localPlayerId={LOCAL_ID} phase="loot" players={PLAYERS} />
    );
    const board: RelicBoard = {
      slots: {
        '0,0': { coord: { q: 0, r: 0 }, ownerId: LOCAL_ID, relicId: 'torch-brand' }, // occupied
        '1,0': { coord: { q: 1, r: 0 }, ownerId: LOCAL_ID, relicId: null },
        '-1,0': { coord: { q: -1, r: 0 }, ownerId: REMOTE_ID, relicId: null },
      },
    };
    await act(async () => {
      socket.handlers.get('RUN_STARTED')!({
        board, synergyMap: {}, relicRegistry: REGISTRY, lootPools: { [LOCAL_ID]: ['ember-core'] },
      });
    });
    fireEvent.click(screen.getByTestId('relic-card-ember-core'));
    // The occupied local slot renders the existing relic's name as <text>.
    const occupied = Array.from(document.querySelectorAll('svg g')).find(
      g => g.querySelector('polygon')?.getAttribute('fill') === '#4488ff' && g.querySelector('text')
    );
    fireEvent.click(occupied!);
    const emitted = socket.emits.find(e => e.event === 'place-relic');
    expect(emitted).toBeDefined();
    expect((emitted!.payload as { relicId: string }).relicId).toBe('ember-core');
  });

  it('offers a relic the player already has placed (pool backfill — re-placeable)', async () => {
    const socket = makeSocket();
    const ref = makeRef(socket);
    render(
      <BoardPanel socketRef={ref as never} localPlayerId={LOCAL_ID} phase="loot" players={PLAYERS} />
    );
    const board: RelicBoard = {
      slots: { '0,0': { coord: { q: 0, r: 0 }, ownerId: LOCAL_ID, relicId: 'ember-core' } },
    };
    await act(async () => {
      socket.handlers.get('RUN_STARTED')!({
        board, synergyMap: {}, relicRegistry: REGISTRY, lootPools: { [LOCAL_ID]: ['ember-core'] },
      });
    });
    // ember-core is on the board AND still offered in the tray (no placed-filter).
    expect(screen.getByTestId('relic-card-ember-core')).toBeTruthy();
  });

  it('clicking an owned empty slot with a selected relic emits place-relic', async () => {
    const socket = makeSocket();
    const ref = makeRef(socket);
    render(
      <BoardPanel
        socketRef={ref as never}
        localPlayerId={LOCAL_ID}
        phase="loot"
        players={PLAYERS}
      />
    );

    const board = makeBoard(LOCAL_ID, REMOTE_ID);
    await act(async () => {
      socket.handlers.get('RUN_STARTED')!({
        board,
        synergyMap: {},
        relicRegistry: REGISTRY,
        lootPools: { [LOCAL_ID]: LOOT_POOL },
      });
    });

    // Select a relic.
    fireEvent.click(screen.getByTestId('relic-card-ember-core'));

    // Click the local-player's first slot (0,0).
    const svgGroups = document.querySelectorAll('svg g');
    // First <g> corresponds to the first slot entry in the board (0,0 → owned by local)
    const localGroup = Array.from(svgGroups).find(g => {
      const poly = g.querySelector('polygon');
      return poly?.getAttribute('fill') === '#4488ff';
    });
    expect(localGroup).toBeTruthy();
    fireEvent.click(localGroup!);

    const emitted = socket.emits.find(e => e.event === 'place-relic');
    expect(emitted).toBeDefined();
    expect((emitted!.payload as { relicId: string }).relicId).toBe('ember-core');
  });

  it('locks the tray after one placement, and a new loot phase unlocks it', async () => {
    const socket = makeSocket();
    const ref = makeRef(socket);
    render(
      <BoardPanel socketRef={ref as never} localPlayerId={LOCAL_ID} phase="loot" players={PLAYERS} />
    );

    await act(async () => {
      socket.handlers.get('RUN_STARTED')!({
        board: makeBoard(LOCAL_ID, REMOTE_ID),
        synergyMap: {},
        relicRegistry: REGISTRY,
        lootPools: { [LOCAL_ID]: LOOT_POOL },
      });
      // The local player places their one relic for this phase.
      socket.handlers.get('RELIC_PLACED')!({
        coord: { q: 0, r: 0 }, relicId: 'ember-core', ownerId: LOCAL_ID, synergyMap: {},
      });
    });

    // Tray is locked: placed-hint shown, the other relic no longer offered.
    expect(screen.getByTestId('relic-placed-hint')).toBeTruthy();
    expect(screen.queryByTestId('relic-card-torch-brand')).toBeNull();

    // Selecting/clicking does nothing now — no further place-relic is emitted.
    socket.emits.length = 0;
    const localGroup = Array.from(document.querySelectorAll('svg g')).find(
      g => g.querySelector('polygon')?.getAttribute('fill') === '#4488ff'
    );
    fireEvent.click(localGroup!);
    expect(socket.emits.find(e => e.event === 'place-relic')).toBeUndefined();

    // Next loot phase delivers a fresh pool and re-enables a single placement.
    await act(async () => {
      socket.handlers.get('PHASE_CHANGED')!({ phase: 'loot', lootPools: { [LOCAL_ID]: ['torch-brand'] } });
    });
    expect(screen.queryByTestId('relic-placed-hint')).toBeNull();
    expect(screen.getByTestId('relic-card-torch-brand')).toBeTruthy();
  });

  it('a downed local player sees a downed message, no relic tray, and cannot place', async () => {
    const socket = makeSocket();
    const ref = makeRef(socket);
    render(
      <BoardPanel
        socketRef={ref as never}
        localPlayerId={LOCAL_ID}
        phase="loot"
        players={PLAYERS}
      />
    );

    const board = makeBoard(LOCAL_ID, REMOTE_ID);
    await act(async () => {
      socket.handlers.get('RUN_STARTED')!({ board, synergyMap: {}, relicRegistry: REGISTRY, lootPools: { [LOCAL_ID]: LOOT_POOL } });
      // The local player goes down.
      socket.handlers.get('PLAYER_DOWNED')!({ playerId: LOCAL_ID });
    });

    expect(screen.getByTestId('board-downed-hint')).toBeTruthy();
    expect(screen.queryByTestId('relic-tray')).toBeNull();

    // Even clicking an owned slot must not emit place-relic while downed.
    const localGroup = Array.from(document.querySelectorAll('svg g')).find(
      g => g.querySelector('polygon')?.getAttribute('fill') === '#4488ff'
    );
    fireEvent.click(localGroup!);
    expect(socket.emits.find(e => e.event === 'place-relic')).toBeUndefined();

    // Being revived restores the tray.
    await act(async () => {
      socket.handlers.get('PLAYER_REVIVED')!({ playerId: LOCAL_ID, hp: 100 });
    });
    expect(screen.queryByTestId('board-downed-hint')).toBeNull();
    expect(screen.getByTestId('relic-tray')).toBeTruthy();
  });

  it('clicking an unowned slot with a selected relic does NOT emit place-relic', async () => {
    const socket = makeSocket();
    const ref = makeRef(socket);
    render(
      <BoardPanel
        socketRef={ref as never}
        localPlayerId={LOCAL_ID}
        phase="loot"
        players={PLAYERS}
      />
    );

    const board = makeBoard(LOCAL_ID, REMOTE_ID);
    await act(async () => {
      socket.handlers.get('RUN_STARTED')!({
        board,
        synergyMap: {},
        relicRegistry: REGISTRY,
        lootPools: { [LOCAL_ID]: LOOT_POOL },
      });
    });

    fireEvent.click(screen.getByTestId('relic-card-ember-core'));

    // Click the remote-player slot.
    const svgGroups = document.querySelectorAll('svg g');
    const remoteGroup = Array.from(svgGroups).find(g => {
      const poly = g.querySelector('polygon');
      return poly?.getAttribute('fill') === '#ff8844';
    });
    expect(remoteGroup).toBeTruthy();
    fireEvent.click(remoteGroup!);

    expect(socket.emits.find(e => e.event === 'place-relic')).toBeUndefined();
  });

  it('RELIC_PLACED updates the slot and removes the relic from tray (T3-loot, R5)', async () => {
    const socket = makeSocket();
    const ref = makeRef(socket);
    render(
      <BoardPanel
        socketRef={ref as never}
        localPlayerId={LOCAL_ID}
        phase="loot"
        players={PLAYERS}
      />
    );

    const board = makeBoard(LOCAL_ID, REMOTE_ID);
    await act(async () => {
      socket.handlers.get('RUN_STARTED')!({
        board,
        synergyMap: {},
        relicRegistry: REGISTRY,
        lootPools: { [LOCAL_ID]: LOOT_POOL },
      });
    });

    // Server confirms placement.
    await act(async () => {
      socket.handlers.get('RELIC_PLACED')!({
        coord: { q: 0, r: 0 },
        relicId: 'ember-core',
        synergyMap: {},
        ownerId: LOCAL_ID,
      });
    });

    // Relic name appears in hex grid.
    expect(screen.getByText('Ember Core')).toBeTruthy();
    // Relic card removed from tray.
    expect(screen.queryByTestId('relic-card-ember-core')).toBeNull();
  });

  it('BOARD_STATE_SYNC replaces board and synergy state', async () => {
    const socket = makeSocket();
    const ref = makeRef(socket);
    render(
      <BoardPanel
        socketRef={ref as never}
        localPlayerId={LOCAL_ID}
        phase="loot"
        players={PLAYERS}
      />
    );

    // Initial state: both relics in tray.
    await act(async () => {
      socket.handlers.get('RUN_STARTED')!({
        board: makeBoard(LOCAL_ID, REMOTE_ID),
        synergyMap: {},
        relicRegistry: REGISTRY,
        lootPools: { [LOCAL_ID]: LOOT_POOL },
      });
    });
    expect(screen.getByTestId('relic-card-ember-core')).toBeTruthy();

    // Sync with ember-core already placed (pool now only has torch-brand).
    const syncedBoard: RelicBoard = {
      slots: {
        '0,0': { coord: { q: 0, r: 0 }, ownerId: LOCAL_ID, relicId: 'ember-core' },
        '1,0': { coord: { q: 1, r: 0 }, ownerId: LOCAL_ID, relicId: null },
        '-1,0': { coord: { q: -1, r: 0 }, ownerId: REMOTE_ID, relicId: null },
      },
    };
    await act(async () => {
      socket.handlers.get('BOARD_STATE_SYNC')!({
        board: syncedBoard,
        synergyMap: {},
        relicRegistry: REGISTRY,
        lootPools: { [LOCAL_ID]: ['torch-brand'] },
      });
    });

    expect(screen.queryByTestId('relic-card-ember-core')).toBeNull();
    expect(screen.getByText('Ember Core')).toBeTruthy();
  });
});

describe('BoardPanel synergy animation (Synergy T1, R1, R2, R3)', () => {
  it('injects a <style> element with id synergy-pulse-style into document.head on mount', () => {
    const socket = makeSocket();
    const ref = makeRef(socket);
    render(
      <BoardPanel
        socketRef={ref as never}
        localPlayerId={LOCAL_ID}
        phase="loot"
        players={PLAYERS}
      />
    );
    expect(document.getElementById('synergy-pulse-style')).toBeTruthy();
  });

  it('a synergized slot <g> has data-synergized="true"', async () => {
    const socket = makeSocket();
    const ref = makeRef(socket);
    render(
      <BoardPanel
        socketRef={ref as never}
        localPlayerId={LOCAL_ID}
        phase="loot"
        players={PLAYERS}
      />
    );

    const board: RelicBoard = {
      slots: {
        '0,0': { coord: { q: 0, r: 0 }, ownerId: LOCAL_ID, relicId: 'ember-core' },
        '1,0': { coord: { q: 1, r: 0 }, ownerId: REMOTE_ID, relicId: null },
      },
    };
    await act(async () => {
      socket.handlers.get('RUN_STARTED')!({
        board,
        synergyMap: { 'ember-core': true },
        relicRegistry: REGISTRY,
        lootPools: {},
      });
    });

    const synergizedGs = document.querySelectorAll('g[data-synergized="true"]');
    expect(synergizedGs.length).toBe(1);
  });

  it('a slot with no relic does NOT have data-synergized', async () => {
    const socket = makeSocket();
    const ref = makeRef(socket);
    render(
      <BoardPanel
        socketRef={ref as never}
        localPlayerId={LOCAL_ID}
        phase="loot"
        players={PLAYERS}
      />
    );

    await act(async () => {
      socket.handlers.get('RUN_STARTED')!({
        board: makeBoard(LOCAL_ID, REMOTE_ID),
        synergyMap: {},
        relicRegistry: REGISTRY,
        lootPools: {},
      });
    });

    expect(document.querySelector('g[data-synergized]')).toBeNull();
  });

  it('a placed-but-not-synergized slot does NOT have data-synergized', async () => {
    const socket = makeSocket();
    const ref = makeRef(socket);
    render(
      <BoardPanel
        socketRef={ref as never}
        localPlayerId={LOCAL_ID}
        phase="loot"
        players={PLAYERS}
      />
    );

    const board: RelicBoard = {
      slots: {
        '0,0': { coord: { q: 0, r: 0 }, ownerId: LOCAL_ID, relicId: 'ember-core' },
      },
    };
    await act(async () => {
      socket.handlers.get('RUN_STARTED')!({
        board,
        synergyMap: {},   // ember-core NOT in synergyMap
        relicRegistry: REGISTRY,
        lootPools: {},
      });
    });

    expect(document.querySelector('g[data-synergized]')).toBeNull();
  });
});

describe('BoardPanel — RELIC_REMOVED (T1, R1)', () => {
  it('removes relic from slot after RELIC_REMOVED event', async () => {
    const socket = makeSocket();
    const ref = makeRef(socket);
    const board = makeBoard(LOCAL_ID, REMOTE_ID);
    board.slots['0,0']!.relicId = 'ember-core';

    render(
      <BoardPanel
        socketRef={ref as never}
        localPlayerId={LOCAL_ID}
        phase="loot"
        players={PLAYERS}
        initialBoard={board}
        initialRegistry={REGISTRY}
        initialLootPool={[]}
      />
    );

    await act(async () => {
      socket.handlers.get('RELIC_REMOVED')!({ coord: { q: 0, r: 0 }, relicId: 'ember-core', reason: 'linked-fates' });
    });

    // Slot should no longer show the relic name text.
    expect(screen.queryByText('Ember Core')).toBeNull();
  });

  it('synergy pulse removed after relic cleared by RELIC_REMOVED', async () => {
    const socket = makeSocket();
    const ref = makeRef(socket);
    const board = makeBoard(LOCAL_ID, REMOTE_ID);
    board.slots['0,0']!.relicId = 'ember-core';

    render(
      <BoardPanel
        socketRef={ref as never}
        localPlayerId={LOCAL_ID}
        phase="loot"
        players={PLAYERS}
        initialBoard={board}
        initialRegistry={REGISTRY}
        initialSynergyMap={{ 'ember-core': true }}
        initialLootPool={[]}
      />
    );

    // Slot should be synergized before removal.
    expect(document.querySelector('g[data-synergized="true"]')).not.toBeNull();

    await act(async () => {
      socket.handlers.get('RELIC_REMOVED')!({ coord: { q: 0, r: 0 }, relicId: 'ember-core', reason: 'linked-fates' });
    });

    // Slot has no relic; synergy class must not be present.
    expect(document.querySelector('g[data-synergized="true"]')).toBeNull();
  });
});

describe('BoardPanel — revive UI (T2, R2, R3, R4, R5)', () => {
  function renderCombatBoard(localId = LOCAL_ID, remoteId = REMOTE_ID) {
    const socket = makeSocket();
    const ref = makeRef(socket);
    const board = makeBoard(localId, remoteId);
    board.slots['0,0']!.relicId = 'ember-core'; // local player has a relic to sacrifice

    render(
      <BoardPanel
        socketRef={ref as never}
        localPlayerId={localId}
        phase="combat"
        players={[localId, remoteId]}
        initialBoard={board}
        initialRegistry={REGISTRY}
        initialLootPool={[]}
      />
    );
    return { socket, ref };
  }

  it('revive-panel shown when teammate downed (R2)', async () => {
    const { socket } = renderCombatBoard();
    await act(async () => {
      socket.handlers.get('PLAYER_DOWNED')!({ playerId: REMOTE_ID });
    });
    expect(screen.getByTestId('revive-panel')).not.toBeNull();
    expect(screen.getByTestId('revive-btn')).not.toBeNull();
  });

  it('revive-panel NOT shown when local player downed (R2)', async () => {
    const { socket } = renderCombatBoard();
    await act(async () => {
      socket.handlers.get('PLAYER_DOWNED')!({ playerId: LOCAL_ID });
    });
    expect(screen.queryByTestId('revive-panel')).toBeNull();
  });

  it('revive-panel hidden after PLAYER_REVIVED (R2)', async () => {
    const { socket } = renderCombatBoard();
    await act(async () => {
      socket.handlers.get('PLAYER_DOWNED')!({ playerId: REMOTE_ID });
    });
    expect(screen.getByTestId('revive-panel')).not.toBeNull();
    await act(async () => {
      socket.handlers.get('PLAYER_REVIVED')!({ playerId: REMOTE_ID, hp: 100 });
    });
    expect(screen.queryByTestId('revive-panel')).toBeNull();
  });

  it('source slots highlighted with data-revive-source after PLAYER_DOWNED (R3)', async () => {
    const { socket } = renderCombatBoard();
    await act(async () => {
      socket.handlers.get('PLAYER_DOWNED')!({ playerId: REMOTE_ID });
    });
    // Local player's slot at 0,0 has ember-core — should be a revive source.
    expect(document.querySelector('g[data-revive-source="true"]')).not.toBeNull();
  });

  it('clicking source slot shows target hint and highlights target slots (R3, R4)', async () => {
    const { socket } = renderCombatBoard();
    await act(async () => {
      socket.handlers.get('PLAYER_DOWNED')!({ playerId: REMOTE_ID });
    });
    const sourceSlot = document.querySelector('g[data-revive-source="true"]');
    await act(async () => { fireEvent.click(sourceSlot!); });
    expect(screen.getByTestId('revive-target-hint')).not.toBeNull();
    // Remote player's slot at -1,0 is empty — should be a revive target.
    expect(document.querySelector('g[data-revive-target="true"]')).not.toBeNull();
  });

  it('clicking target slot emits revive event and hides panel (R4)', async () => {
    const { socket } = renderCombatBoard();
    await act(async () => {
      socket.handlers.get('PLAYER_DOWNED')!({ playerId: REMOTE_ID });
    });
    const sourceSlot = document.querySelector('g[data-revive-source="true"]');
    await act(async () => { fireEvent.click(sourceSlot!); });
    const targetSlot = document.querySelector('g[data-revive-target="true"]');
    await act(async () => { fireEvent.click(targetSlot!); });

    const reviveEmit = socket.emits.find(e => e.event === 'revive');
    expect(reviveEmit).toBeDefined();
    expect((reviveEmit!.payload as { sourceCoord: unknown }).sourceCoord).toEqual({ q: 0, r: 0 });
    expect(screen.queryByTestId('revive-panel')).toBeNull();
  });

  it('LINKED_FATES_ERROR shows error message in panel (R5)', async () => {
    const { socket } = renderCombatBoard();
    await act(async () => {
      socket.handlers.get('PLAYER_DOWNED')!({ playerId: REMOTE_ID });
    });
    await act(async () => {
      socket.handlers.get('LINKED_FATES_ERROR')!({ code: 'NO_RELIC', message: 'No relic in that slot.' });
    });
    expect(screen.getByTestId('linked-fates-error').textContent).toContain('No relic in that slot.');
  });
});

describe('BoardPanel — relic detail panel (R1)', () => {
  function renderLootBoard() {
    const socket = makeSocket();
    const ref = makeRef(socket);
    render(
      <BoardPanel
        socketRef={ref as never}
        localPlayerId={LOCAL_ID}
        phase="loot"
        players={PLAYERS}
        initialBoard={makeBoard(LOCAL_ID, REMOTE_ID)}
        initialRegistry={REGISTRY}
        initialLootPool={['ember-core', 'torch-brand']}
      />
    );
    return { socket };
  }

  it('relic-detail is not shown before any selection', () => {
    renderLootBoard();
    expect(screen.queryByTestId('relic-detail')).toBeNull();
  });

  it('relic-detail appears after selecting a relic card', () => {
    renderLootBoard();
    fireEvent.click(screen.getByTestId('relic-card-ember-core'));
    expect(screen.getByTestId('relic-detail')).not.toBeNull();
  });

  it('relic-detail-base shows the base effect description', () => {
    renderLootBoard();
    fireEvent.click(screen.getByTestId('relic-card-ember-core'));
    expect(screen.getByTestId('relic-detail-base').textContent).toContain(RELIC_A.baseEffect.description);
  });

  it('relic-detail-synergy shows the synergy effect description', () => {
    renderLootBoard();
    fireEvent.click(screen.getByTestId('relic-card-ember-core'));
    expect(screen.getByTestId('relic-detail-synergy').textContent).toContain(RELIC_A.synergyEffect.description);
  });

  it('relic-detail hides when the same card is clicked again (deselect)', () => {
    renderLootBoard();
    fireEvent.click(screen.getByTestId('relic-card-ember-core'));
    fireEvent.click(screen.getByTestId('relic-card-ember-core'));
    expect(screen.queryByTestId('relic-detail')).toBeNull();
  });

  it('relic-detail updates when a different card is selected', () => {
    renderLootBoard();
    fireEvent.click(screen.getByTestId('relic-card-ember-core'));
    fireEvent.click(screen.getByTestId('relic-card-torch-brand'));
    expect(screen.getByTestId('relic-detail-base').textContent).toContain(RELIC_B.baseEffect.description);
  });
});

describe('BoardPanel — placement error + empty tray hint (T1, R1, R2)', () => {
  function renderLoot(lootPool: string[] = ['ember-core', 'torch-brand']) {
    const socket = makeSocket();
    const ref = makeRef(socket);
    render(
      <BoardPanel
        socketRef={ref as never}
        localPlayerId={LOCAL_ID}
        phase="loot"
        players={PLAYERS}
        initialBoard={makeBoard(LOCAL_ID, REMOTE_ID)}
        initialRegistry={REGISTRY}
        initialLootPool={lootPool}
      />
    );
    return { socket };
  }

  it('RELIC_PLACE_ERROR shows placement-error with server message (R1)', async () => {
    const { socket } = renderLoot();
    await act(async () => {
      socket.handlers.get('RELIC_PLACE_ERROR')!({ code: 'SLOT_OCCUPIED', message: 'That slot is already occupied.' });
    });
    expect(screen.getByTestId('placement-error').textContent).toContain('That slot is already occupied.');
  });

  it('placement-error clears on RELIC_PLACED (R1)', async () => {
    const { socket } = renderLoot();
    await act(async () => {
      socket.handlers.get('RELIC_PLACE_ERROR')!({ code: 'NOT_OWNER', message: 'Not your slot.' });
    });
    await act(async () => {
      socket.handlers.get('RELIC_PLACED')!({
        coord: { q: 0, r: 0 }, relicId: 'ember-core',
        ownerId: LOCAL_ID, synergyMap: {},
      });
    });
    expect(screen.queryByTestId('placement-error')).toBeNull();
  });

  it('relic-placed-hint shown after the player places their one relic this phase (R2)', async () => {
    const { socket } = renderLoot(['ember-core', 'torch-brand']);
    // Place one relic — one per loot phase, so the tray locks afterward.
    await act(async () => {
      socket.handlers.get('RELIC_PLACED')!({
        coord: { q: 0, r: 0 }, relicId: 'ember-core',
        ownerId: LOCAL_ID, synergyMap: {},
      });
    });
    expect(screen.getByTestId('relic-placed-hint')).not.toBeNull();
    // The still-available relic is no longer offered (locked for the phase).
    expect(screen.queryByTestId('relic-card-torch-brand')).toBeNull();
  });

  it('tray-ready-hint NOT shown when relics still available (R2)', () => {
    renderLoot(['ember-core', 'torch-brand']);
    expect(screen.queryByTestId('tray-ready-hint')).toBeNull();
    expect(screen.getByTestId('relic-card-ember-core')).not.toBeNull();
  });

  it('tray-ready-hint shown immediately when lootPool starts empty (R2)', () => {
    renderLoot([]);
    expect(screen.getByTestId('tray-ready-hint')).not.toBeNull();
  });
});
