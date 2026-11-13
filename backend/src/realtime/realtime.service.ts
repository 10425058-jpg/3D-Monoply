import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

export interface MatchBroadcast {
  event: string;
  envelope: {
    eventId: string;
    occurredAt: string;
    matchId: string;
    stateVersion: number;
    sequence?: number;
    payload: unknown;
  };
}

export const roomChannel = (roomId: string) => `room:${roomId}`;
export const matchChannel = (matchId: string) => `match:${matchId}`;

/**
 * Sends Socket.IO notifications. Only call these AFTER the database transaction has committed.
 * Sockets are notification-only: no game state is ever changed through them.
 */
@Injectable()
export class RealtimeService {
  /** The Socket.IO "/game" namespace. Set by GameGateway when the server starts. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private server: any = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  attach(server: any): void {
    this.server = server;
  }

  /** Envelope for room:* messages (docs/SOCKET-EVENTS.md §2). */
  roomEnvelope(roomId: string, payload: unknown) {
    return { eventId: randomUUID(), occurredAt: new Date().toISOString(), roomId, payload };
  }

  toRoom(roomId: string, event: string, payload: unknown): void {
    this.server?.to(roomChannel(roomId)).emit(event, this.roomEnvelope(roomId, payload));
  }

  toMatch(matchId: string, broadcasts: MatchBroadcast[]): void {
    for (const b of broadcasts) this.server?.to(matchChannel(matchId)).emit(b.event, b.envelope);
  }

  /** A match notification that is not part of the stored event log (for example presence). */
  toMatchUnsequenced(matchId: string, event: string, stateVersion: number, payload: unknown): void {
    this.toMatch(matchId, [
      { event, envelope: { eventId: randomUUID(), occurredAt: new Date().toISOString(), matchId, stateVersion, payload } },
    ]);
  }
}
