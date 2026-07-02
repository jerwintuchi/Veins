// Wire-protocol message payload types for the Field Phase system.
// Types only — no logic (invariant I4). All messages use the envelope:
//   { "type": "EVENT_NAME", "payload": { ... } }

import type { StubFieldData, StubTestament, StubArchiveEntry } from './fieldPhase.js';
import type { Channel, Sign, Stimulus } from './signs.js';

// ── Client → Server ───────────────────────────────────────────────────────────

export type DeployPayload = Record<string, never>;

export type ExtractPayload = Record<string, never>;

export type ProbePayload = { stimulus: Stimulus };

// ── Server → Client ───────────────────────────────────────────────────────────

export type FieldStartedPayload = {
  fieldData:         StubFieldData;
  reconnectToken:    string;     // per-player token; delivered individually, not as a broadcast
  signs:             Sign[];     // ambient signs, filtered to this player's perceived channels
  perceivedChannels: Channel[];  // this player's own perception set — never other players' sets
};

export type FieldTestamentPayload = {
  testament: StubTestament;
};

export type ArchiveUpdatedPayload = {
  entries: StubArchiveEntry[];
};

export type ProbeResultPayload = {
  playerId: string;       // who probed (the party sees who spent the exposure)
  stimulus: Stimulus;     // echo of the client-chosen stimulus — party behavior, not trait data
  sign:     Sign | null;  // the reaction sign for REACTION perceivers; null = "you cannot read it"
  exposure: number;       // room exposure after this probe — party noise, not Incarnate knowledge
};
