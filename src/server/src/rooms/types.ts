// Server-only room types. Never exported from @testament/shared (I4).
import type { RoomCode, RoomPhase, LobbyPlayer, StubFieldData, Sign, Channel } from '@testament/shared';
import type { ContractRecord } from '../incarnate/contractRecord.js';

export type { RoomCode };

export type ServerPlayerEntry = {
  playerId: string;
  displayName: string;
  socketId: string;
  isLeader: boolean;
  readyState: boolean;
  disconnectedAt: number | null;
  // Distributed Perception (R61): empty until DEPLOY assigns. Keyed to the
  // player entry (playerId), not the socket, so it survives reconnection (R63).
  perceivedChannels: Channel[];
};

export type RoomRecord = {
  code: RoomCode;
  phase: RoomPhase;
  players: ServerPlayerEntry[];
  contract: ContractRecord | null;
  fieldData: StubFieldData | null;  // null until DEPLOY succeeds; never client-supplied
  exposure: number;                 // field pressure accrued by party behavior; reset on DEPLOY (R57)
  revealedSigns: Sign[];            // reaction signs revealed by probes, deduped by token (R58)
};

export type ReconnectToken = string;

export type ReconnectEntry = {
  token: ReconnectToken;
  playerId: string;
  roomCode: RoomCode;
  issuedAt: number;
};

// Injected I/O functions — keep handlers pure and unit-testable without a real WebSocket server.
export type EmitFn = (type: string, payload: unknown) => void;
export type EmitToFn = (socketId: string, type: string, payload: unknown) => void;
export type BroadcastFn = (roomCode: RoomCode, type: string, payload: unknown) => void;

// Converts a ServerPlayerEntry to the shared LobbyPlayer type (strips server-only fields).
export function toPublicPlayer(p: ServerPlayerEntry): LobbyPlayer {
  return {
    playerId: p.playerId,
    displayName: p.displayName,
    isLeader: p.isLeader,
    readyState: p.readyState,
  };
}
