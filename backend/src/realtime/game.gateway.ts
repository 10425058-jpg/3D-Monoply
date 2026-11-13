import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { randomUUID } from 'node:crypto';
import type { Namespace, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { AppError, matchNotFound, roomNotFound, toErrorBody, unauthorized, validationError } from '../common/errors';
import { isUuid } from '../common/validate';
import { config } from '../config';
import { LifecycleService } from '../matches/lifecycle.service';
import { MatchesService } from '../matches/matches.service';
import { RoomsService } from '../rooms/rooms.service';
import { matchChannel, RealtimeService, roomChannel } from './realtime.service';

type Ack = { ok: true; data: Record<string, unknown> } | { ok: false; error: { code: string; message: string; details: Record<string, unknown> } };

/**
 * Socket.IO namespace "/game" (docs/SOCKET-EVENTS.md).
 *
 * Clients can only SUBSCRIBE here: room:join, room:leave, match:join, match:leave.
 * There are deliberately no gameplay commands on the socket. Every change goes through REST.
 */
@WebSocketGateway({ namespace: '/game', cors: { origin: config.corsOrigins, credentials: true } })
export class GameGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(GameGateway.name);

  constructor(
    private readonly auth: AuthService,
    private readonly realtime: RealtimeService,
    private readonly rooms: RoomsService,
    private readonly matches: MatchesService,
    private readonly lifecycle: LifecycleService,
  ) {}

  afterInit(server: Namespace): void {
    this.realtime.attach(server);
    // Authenticate the handshake. A bad token is rejected before the connection is accepted,
    // so the client receives a normal Socket.IO "connect_error".
    server.use((socket, next) => {
      try {
        const token: unknown = socket.handshake.auth?.token;
        const { userId, exp } = this.auth.verifyAccessToken(typeof token === 'string' ? token : undefined);
        socket.data.userId = userId;
        socket.data.tokenExp = exp;
        next();
      } catch {
        next(new Error('UNAUTHORIZED'));
      }
    });
  }

  handleConnection(client: Socket): void {
    // Access tokens live 15 minutes. When this one expires the socket is closed; the client
    // refreshes over REST and reconnects with the new token (docs/SOCKET-EVENTS.md §5).
    const msLeft = Number(client.data.tokenExp) * 1000 - Date.now();
    const timer = setTimeout(() => {
      client.emit('server_error', { code: 'UNAUTHORIZED', message: 'Access token expired. Refresh and reconnect.', details: {} });
      client.disconnect(true);
    }, Math.max(msLeft, 0));
    client.once('disconnect', () => clearTimeout(timer));
  }

  async handleDisconnect(client: Socket): Promise<void> {
    await this.lifecycle.socketClosed(client.id);
  }

  @SubscribeMessage('room:join')
  roomJoin(@ConnectedSocket() client: Socket, @MessageBody() data: unknown): Promise<Ack> {
    return this.handle(client, async (userId) => {
      const roomId = this.id(data, 'roomId');
      if (!roomId) throw roomNotFound();
      const room = await this.rooms.getForMember(roomId, userId); // authorizes on every join
      await client.join(roomChannel(roomId));
      client.emit('room:snapshot', this.realtime.roomEnvelope(roomId, room));
      return { subscribed: true };
    });
  }

  @SubscribeMessage('room:leave')
  roomLeave(@ConnectedSocket() client: Socket, @MessageBody() data: unknown): Promise<Ack> {
    return this.handle(client, async () => {
      const roomId = this.id(data, 'roomId');
      if (!roomId) throw roomNotFound();
      await client.leave(roomChannel(roomId)); // unsubscribe only; does not leave the lobby
      return { subscribed: false };
    });
  }

  @SubscribeMessage('match:join')
  matchJoin(@ConnectedSocket() client: Socket, @MessageBody() data: unknown): Promise<Ack> {
    return this.handle(client, async (userId) => {
      const matchId = this.id(data, 'matchId');
      if (!matchId) throw matchNotFound();
      await this.matches.getSnapshot(matchId, userId); // authorizes on every join
      await client.join(matchChannel(matchId));
      await this.lifecycle.socketJoined(matchId, userId, client.id);
      // Personal snapshot, sent to this socket only (it contains this viewer's allowedActions).
      const snapshot = await this.matches.getSnapshot(matchId, userId);
      client.emit('match:snapshot', {
        eventId: randomUUID(),
        occurredAt: new Date().toISOString(),
        matchId,
        stateVersion: snapshot.stateVersion,
        payload: snapshot,
      });
      return { subscribed: true };
    });
  }

  @SubscribeMessage('match:leave')
  matchLeave(@ConnectedSocket() client: Socket, @MessageBody() data: unknown): Promise<Ack> {
    return this.handle(client, async (userId) => {
      const matchId = this.id(data, 'matchId');
      if (!matchId) throw matchNotFound();
      await client.leave(matchChannel(matchId)); // unsubscribe only; does not forfeit
      await this.lifecycle.socketLeft(matchId, userId, client.id);
      return { subscribed: false };
    });
  }

  // -------------------------------------------------------------------------

  private id(data: unknown, field: string): string | null {
    if (typeof data !== 'object' || data === null) throw validationError(`${field} is required.`);
    const value = (data as Record<string, unknown>)[field];
    return isUuid(value) ? value.toLowerCase() : null;
  }

  /** Runs a handler and turns the result or error into the acknowledgement format. */
  private async handle(client: Socket, fn: (userId: string) => Promise<Record<string, unknown>>): Promise<Ack> {
    try {
      const userId: unknown = client.data.userId;
      if (typeof userId !== 'string' || Number(client.data.tokenExp) * 1000 <= Date.now()) throw unauthorized();
      return { ok: true, data: await fn(userId) };
    } catch (error) {
      if (error instanceof AppError) return { ok: false, error: toErrorBody(error) };
      this.logger.error(error instanceof Error ? error.stack ?? error.message : String(error));
      return { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.', details: {} } };
    }
  }
}
