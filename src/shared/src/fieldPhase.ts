// Field-phase shared types. Types only — no logic (invariant I4).
// NOTE: No traitRoll, no hiddenTraits, no Aspect, no Frailty, no Ward anywhere in this file.
// Those live server-side only (I5, CLAUDE.md invariant 3).
import type { Channel, Sign } from './signs.js';

export type StubFieldData = {
  fieldId: string;        // placeholder: "FIELD-001"
  siteName: string;       // copied from StubContract.siteName
  incarnateName: string;  // copied from StubContract.targetName
};

export type StubArchiveEntry = {
  contractId: string;
  targetName: string;
  siteName: string;
  outcome: 'success';   // skeleton: always success (Phase 5 adds 'failure')
  notes: string;
};

export type StubTestament = {
  expeditionId: string;         // UUID v4, generated server-side at extraction
  contractId: string;
  outcome: 'success';
  entries: StubArchiveEntry[];
};

export type FieldSnapshot = {
  fieldData:         StubFieldData;
  archiveEntries:    StubArchiveEntry[];
  signs:             Sign[];     // ambient + revealed reactions, filtered to this player's channels
  perceivedChannels: Channel[];  // this player's own perception set
};
