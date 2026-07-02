// Wire-protocol message payload types for the Field Phase system.
// Types only — no logic (invariant I4). All messages use the envelope:
//   { "type": "EVENT_NAME", "payload": { ... } }

import type { StubFieldData, StubTestament, StubArchiveEntry } from './fieldPhase.js';
import type { Sign, Stimulus } from './signs.js';

// ── Client → Server ───────────────────────────────────────────────────────────

export type DeployPayload = Record<string, never>;

export type ExtractPayload = Record<string, never>;

export type ProbePayload = { stimulus: Stimulus };

// ── Server → Client ───────────────────────────────────────────────────────────

export type FieldStartedPayload = {
  fieldData:      StubFieldData;
  reconnectToken: string;    // per-player token; delivered individually, not as a broadcast
  signs:          Sign[];    // ambient signs derived from the expedition's TraitRoll
};

export type FieldTestamentPayload = {
  testament: StubTestament;
};

export type ArchiveUpdatedPayload = {
  entries: StubArchiveEntry[];
};

export type ProbeResultPayload = {
  playerId: string;    // who probed (the party sees who spent the exposure)
  stimulus: Stimulus;  // echo of the client-chosen stimulus — party behavior, not trait data
  sign:     Sign;      // the reaction: a REACTION lexicon sign or the no-reaction sign
  exposure: number;    // room exposure after this probe — party noise, not Incarnate knowledge
};
