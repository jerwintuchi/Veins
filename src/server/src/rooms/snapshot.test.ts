import { describe, it, expect } from 'vitest';
import { toSnapshot, buildFieldSnapshot } from './snapshot.js';
import type { RoomRecord, ServerPlayerEntry } from './types.js';
import type { ContractRecord } from '../incarnate/contractRecord.js';
import { SessionArchive } from './SessionArchive.js';
import type { Channel } from '@testament/shared';
import { CHANNELS } from '@testament/shared';

const STUB_CONTRACT_RECORD: ContractRecord = {
  contractId:     'c-001',
  tier:           'APPRENTICE',
  targetName:     'The Ashen Warden',
  siteName:       'The Collapsed Chancel',
  primaryVerb:    'INVESTIGATE',
  expeditionSeed: 'test-seed',
  traitRoll:      { aspect: 'EMBER', frailty: 'FLAME', tell: 'LUNGE' },
};

function makePlayer(id: string, socketId: string, channels: Channel[] = [...CHANNELS]): ServerPlayerEntry {
  return { playerId: id, displayName: id, socketId, isLeader: id === 'p1', readyState: false, disconnectedAt: 123, perceivedChannels: channels };
}

function makeRoom(phase: RoomRecord['phase'] = 'WAITING'): RoomRecord {
  return {
    code: 'ABC123', phase, players: [makePlayer('p1', 's1')],
    contract: null, fieldData: null, exposure: 0, revealedSigns: [],
  };
}

function makeFieldRoom(): RoomRecord {
  return {
    code: 'ABC123', phase: 'FIELD',
    players: [makePlayer('p1', 's1')],
    contract: STUB_CONTRACT_RECORD,
    fieldData: { fieldId: 'FIELD-001', siteName: 'The Collapsed Chancel', incarnateName: 'The Ashen Warden' },
    exposure: 0,
    revealedSigns: [],
  };
}

// T9: snapshot projection

describe('toSnapshot', () => {
  it('output matches LobbySnapshot shape', () => {
    const room: RoomRecord = {
      code: 'ABC123',
      phase: 'WAITING',
      players: [makePlayer('p1', 's1'), makePlayer('p2', 's2')],
      contract: null,
      fieldData: null,
      exposure: 0,
      revealedSigns: [],
    };
    const snap = toSnapshot(room);
    expect(snap.roomCode).toBe('ABC123');
    expect(snap.phase).toBe('WAITING');
    expect(snap.contract).toBeNull();
    expect(snap.players).toHaveLength(2);
  });

  it('strips socketId from every player entry', () => {
    const room: RoomRecord = {
      code: 'ABC123', phase: 'WAITING',
      players: [makePlayer('p1', 's1')], contract: null, fieldData: null,
      exposure: 0, revealedSigns: [],
    };
    const snap = toSnapshot(room);
    expect('socketId' in (snap.players[0] ?? {})).toBe(false);
  });

  it('strips disconnectedAt from every player entry', () => {
    const room: RoomRecord = {
      code: 'ABC123', phase: 'WAITING',
      players: [makePlayer('p1', 's1')], contract: null, fieldData: null,
      exposure: 0, revealedSigns: [],
    };
    const snap = toSnapshot(room);
    expect('disconnectedAt' in (snap.players[0] ?? {})).toBe(false);
  });

  it('preserves join-time order (index order of players array)', () => {
    const room: RoomRecord = {
      code: 'ABC123', phase: 'WAITING',
      players: [makePlayer('p1', 's1'), makePlayer('p2', 's2'), makePlayer('p3', 's3')],
      contract: null, fieldData: null, exposure: 0, revealedSigns: [],
    };
    const snap = toSnapshot(room);
    expect(snap.players.map(p => p.playerId)).toEqual(['p1', 'p2', 'p3']);
  });
});

// T31: buildFieldSnapshot

describe('buildFieldSnapshot', () => {
  it('returns null when phase is WAITING', () => {
    const archive = new SessionArchive();
    expect(buildFieldSnapshot(makeRoom('WAITING'), archive, 'p1')).toBeNull();
  });

  it('returns null when phase is DEPLOYING', () => {
    const archive = new SessionArchive();
    expect(buildFieldSnapshot(makeRoom('DEPLOYING'), archive, 'p1')).toBeNull();
  });

  it('returns FieldSnapshot when phase is FIELD and fieldData + contract are set', () => {
    const archive = new SessionArchive();
    const room = makeFieldRoom();
    const snap = buildFieldSnapshot(room, archive, 'p1');
    expect(snap).not.toBeNull();
    expect(snap?.fieldData.fieldId).toBe('FIELD-001');
  });

  it('FieldSnapshot includes signs derived from the contract TraitRoll (R49)', () => {
    const archive = new SessionArchive();
    const snap = buildFieldSnapshot(makeFieldRoom(), archive, 'p1');
    expect(snap?.signs).toBeDefined();
    expect(snap?.signs.length).toBe(3);  // Apprentice tier: 3 signs
    expect(snap?.signs.map(s => s.channel)).toEqual(['RESIDUE', 'STRESS_MARK', 'OMEN']);
    for (const sign of snap!.signs) {
      expect(Object.keys(sign).sort()).toEqual(['channel', 'token']);
    }
  });

  it('archiveEntries matches what archive.getEntries returns for the room code', () => {
    const archive = new SessionArchive();
    archive.append('ABC123', [{
      contractId: 'c-001', targetName: 'T', siteName: 'S', outcome: 'success', notes: '',
    }]);
    const snap = buildFieldSnapshot(makeFieldRoom(), archive, 'p1');
    expect(snap?.archiveEntries).toHaveLength(1);
    expect(snap?.archiveEntries[0]?.contractId).toBe('c-001');
  });

  it('returns null when contract is null even if phase is FIELD (guard for sign derivation)', () => {
    const archive = new SessionArchive();
    const room = makeRoom('FIELD');
    room.fieldData = { fieldId: 'FIELD-001', siteName: 'S', incarnateName: 'T' };
    // contract remains null
    expect(buildFieldSnapshot(room, archive, 'p1')).toBeNull();
  });

  // T60: ambient signs are probe-gated; revealed reaction signs survive reconnect (R58, P22, P24)

  it('snapshot signs contain no REACTION channel when nothing has been probed (P22)', () => {
    const archive = new SessionArchive();
    const room = makeFieldRoom();
    room.contract = {
      ...STUB_CONTRACT_RECORD,
      tier: 'JOURNEYMAN',
      traitRoll: { aspect: 'EMBER', frailty: 'FLAME', tell: 'LUNGE', ward: 'COLD', disposition: 'STALKER' },
    };
    const snap = buildFieldSnapshot(room, archive, 'p1');
    expect(snap?.signs.map(s => s.channel)).toEqual(['RESIDUE', 'STRESS_MARK', 'OMEN', 'SPOOR']);
  });

  it('snapshot signs = ambient signs ++ revealedSigns (P24)', () => {
    const archive = new SessionArchive();
    const room = makeFieldRoom();
    room.revealedSigns = [
      { channel: 'REACTION', token: 'no-reaction' },
      { channel: 'REACTION', token: 'drinks-cold' },
    ];
    const snap = buildFieldSnapshot(room, archive, 'p1');
    expect(snap?.signs.map(s => s.channel)).toEqual(
      ['RESIDUE', 'STRESS_MARK', 'OMEN', 'REACTION', 'REACTION'],
    );
    expect(snap?.signs.slice(3).map(s => s.token)).toEqual(['no-reaction', 'drinks-cold']);
  });

  // T66: per-player filtering on reconnect (R63, P28)

  it("filters signs to the requesting player's perceived channels (P28)", () => {
    const archive = new SessionArchive();
    const room = makeFieldRoom();
    room.players[0]!.perceivedChannels = ['RESIDUE', 'OMEN'];
    const snap = buildFieldSnapshot(room, archive, 'p1');
    expect(snap?.signs.map(s => s.channel)).toEqual(['RESIDUE', 'OMEN']);
    expect(snap?.perceivedChannels).toEqual(['RESIDUE', 'OMEN']);
  });

  it('a non-REACTION perceiver does not receive revealed reaction signs (R63)', () => {
    const archive = new SessionArchive();
    const room = makeFieldRoom();
    room.players[0]!.perceivedChannels = ['RESIDUE', 'STRESS_MARK', 'OMEN'];
    room.revealedSigns = [{ channel: 'REACTION', token: 'drinks-cold' }];
    const snap = buildFieldSnapshot(room, archive, 'p1');
    expect(snap?.signs.every(s => s.channel !== 'REACTION')).toBe(true);
  });

  it('a REACTION perceiver receives revealed reaction signs, filtered to their set', () => {
    const archive = new SessionArchive();
    const room = makeFieldRoom();
    room.players[0]!.perceivedChannels = ['REACTION'];
    room.revealedSigns = [{ channel: 'REACTION', token: 'drinks-cold' }];
    const snap = buildFieldSnapshot(room, archive, 'p1');
    expect(snap?.signs).toEqual([{ channel: 'REACTION', token: 'drinks-cold' }]);
  });

  it('returns null for a playerId not in the room', () => {
    const archive = new SessionArchive();
    expect(buildFieldSnapshot(makeFieldRoom(), archive, 'ghost')).toBeNull();
  });
});
