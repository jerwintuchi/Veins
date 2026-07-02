import { describe, it, expect } from 'vitest';
import type { RoomSummary, JoinRoomRequest, RunStartedEvent, LobbyErrorEvent, LobbySnapshot, LobbyPlayer } from './lobby.js';
import type { ContractIntel } from './contract.js';
import { MAX_PLAYERS, MIN_PLAYERS_TO_START, HEX_BOARD_RADIUS, MAX_ROOM_PLAYERS, ROOM_CODE_LENGTH, ROOM_CODE_ALPHABET } from './lobby.js';
import type { RoomPhase } from './lobby.js';

describe('lobby constants', () => {
  it('have the expected values', () => {
    expect(MAX_PLAYERS).toBe(4);
    expect(MIN_PLAYERS_TO_START).toBe(1); // solo play supported — see specs/solo-play
    expect(HEX_BOARD_RADIUS).toBe(2);
  });
});

describe('lobby types', () => {
  it('instantiate cleanly under strict mode', () => {
    const summary: RoomSummary = {
      code: 'ABCDE',
      status: 'lobby',
      hostId: 'p1',
      players: ['p1', 'p2'],
    };
    const join: JoinRoomRequest = { code: 'ABCDE', playerId: 'p3' };
    const err: LobbyErrorEvent = { code: 'ROOM_FULL', message: 'full' };

    expect(summary.status).toBe('lobby');
    expect(join.playerId).toBe('p3');
    expect(err.code).toBe('ROOM_FULL');

    // RunStartedEvent shape compiles (structurally checked).
    const started: Pick<RunStartedEvent, 'board' | 'synergyMap'> = {
      board: { slots: {} },
      synergyMap: {},
    };
    expect(started.board.slots).toEqual({});
  });
});

// ── T1: Testament Phase 3 lobby types ────────────────────────────────────────

describe('Testament lobby constants', () => {
  it('MAX_ROOM_PLAYERS is 4', () => {
    expect(MAX_ROOM_PLAYERS).toBe(4);
  });

  it('ROOM_CODE_LENGTH is 6', () => {
    expect(ROOM_CODE_LENGTH).toBe(6);
  });

  it('ROOM_CODE_ALPHABET contains no ambiguous characters', () => {
    expect(ROOM_CODE_ALPHABET).not.toContain('I');
    expect(ROOM_CODE_ALPHABET).not.toContain('O');
    expect(ROOM_CODE_ALPHABET).not.toContain('0');
    expect(ROOM_CODE_ALPHABET).not.toContain('1');
    expect(ROOM_CODE_ALPHABET.length).toBeGreaterThan(0);
  });

  it('RoomPhase accepts exactly WAITING, DEPLOYING, FIELD, COMPLETE (exhaustive switch)', () => {
    const check = (p: RoomPhase): string => {
      switch (p) {
        case 'WAITING':   return 'w';
        case 'DEPLOYING': return 'd';
        case 'FIELD':     return 'f';
        case 'COMPLETE':  return 'c';
      }
    };
    expect(check('WAITING')).toBe('w');
    expect(check('DEPLOYING')).toBe('d');
    expect(check('FIELD')).toBe('f');
    expect(check('COMPLETE')).toBe('c');
    // @ts-expect-error — a fifth literal must not be assignable to RoomPhase
    const _bad: RoomPhase = 'ABANDONED';
  });
});

describe('ContractIntel has no traitRoll or expeditionSeed field', () => {
  it('structurally lacks server-only fields', () => {
    const contract: ContractIntel = {
      contractId: 'c-001',
      targetName: 'The Ashen Warden',
      siteName: 'The Collapsed Chancel',
      primaryVerb: 'INVESTIGATE',
      tier: 'APPRENTICE',
    };
    expect(Object.keys(contract)).not.toContain('traitRoll');
    expect(Object.keys(contract)).not.toContain('expeditionSeed');
    expect(contract.tier).toBe('APPRENTICE');
  });
});

describe('LobbySnapshot shape', () => {
  it('constructs with null contract while WAITING', () => {
    const player: LobbyPlayer = { playerId: 'p1', displayName: 'Aldric', isLeader: true, readyState: false };
    const snap: LobbySnapshot = {
      roomCode: 'ABC123',
      phase: 'WAITING',
      players: [player],
      contract: null,
    };
    expect(snap.phase).toBe('WAITING');
    expect(snap.contract).toBeNull();
    expect(snap.players[0]?.isLeader).toBe(true);
  });
});
