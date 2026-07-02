// Wire-protocol message payload types for the Lobby & Room system.
// Types only — no logic (invariant I4). All messages use the envelope:
//   { "type": "EVENT_NAME", "payload": { ... } }

import type { LobbySnapshot, RoomCode } from './lobby.js';
import type { ContractIntel } from './contract.js';
import type { FieldSnapshot } from './fieldPhase.js';

// ── Client → Server ───────────────────────────────────────────────────────────

export type CreateRoomPayload = {
  displayName: string;
};

export type JoinRoomPayload = {
  code: RoomCode;
  displayName: string;
};

export type ToggleReadyPayload = Record<string, never>;

export type AcceptContractPayload = Record<string, never>;

export type LeaveRoomPayload = Record<string, never>;

export type ReconnectPayload = {
  token: string;
};

// ── Server → Client ───────────────────────────────────────────────────────────

export type RoomCreatedPayload = {
  snapshot: LobbySnapshot;
  reconnectToken: string;
};

export type LobbyUpdatedPayload = {
  snapshot: LobbySnapshot;
};

export type RoomDeployingPayload = {
  contract: ContractIntel;
};

export type StateResyncPayload = {
  snapshot: LobbySnapshot;
  fieldSnapshot: FieldSnapshot | null;  // null when phase is WAITING or DEPLOYING
  reconnectToken: string;
};

export type LobbyErrorCode =
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'ALREADY_DEPLOYING'
  | 'NOT_LEADER'
  | 'PARTY_NOT_READY'
  | 'INVALID_PAYLOAD'
  | 'NOT_IN_ROOM'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_NOT_FOUND'
  | 'WRONG_PHASE';

export type LobbyErrorPayload = {
  code: LobbyErrorCode;
  message: string;
};
