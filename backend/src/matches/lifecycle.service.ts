import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { config } from '../config';
import { abandonMatch } from '../game/rules/engine';
import { PrismaService } from '../prisma/prisma.service';
import { MatchBroadcast, RealtimeService } from '../realtime/realtime.service';
import { loadRoomState, lockRoom } from '../rooms/room-state';
import { appendEvents, CONTENT, isTerminal, loadMatch, lockMatch, overduePlayerIds, saveEngineState, toEngineState } from './match-store';

const ACTIVE = ['IN_PROGRESS', 'PAUSED'];

/**
 * Presence and match lifecycle (docs/API-CONTRACT.md §5):
 * - a player is DISCONNECTED only when all of their match sockets are gone
 * - 120 seconds offline -> the match is PAUSED (never an automatic forfeit)
 * - everyone still in the game reconnects -> the match resumes
 * - host offline for 120 seconds -> the connected, non-bankrupt player with the lowest seat becomes host
 * - nobody online for 24 hours -> the match is ABANDONED
 *
 * All deadlines are stored in the database and checked by a periodic sweep, so they survive
 * a server restart. The socket registry itself is in memory: this design assumes ONE server
 * process. To run several, move the registry to a shared store (for example Redis).
 */
@Injectable()
export class LifecycleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LifecycleService.name);
  /** "matchId:userId" -> socket ids subscribed to that match. */
  private readonly sockets = new Map<string, Set<string>>();
  /** socket id -> the "matchId:userId" keys it belongs to. */
  private readonly keysBySocket = new Map<string, Set<string>>();
  private timer: NodeJS.Timeout | null = null;
  private sweeping = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.resetPresenceAfterRestart();
    } catch (error) {
      this.logger.error(`Could not reset presence at startup: ${error instanceof Error ? error.message : error}`);
    }
    this.timer = setInterval(() => void this.sweep(), config.lifecycleSweepMs);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  // -------------------------------------------------------------------------
  // Socket registry (called by GameGateway)
  // -------------------------------------------------------------------------

  async socketJoined(matchId: string, userId: string, socketId: string): Promise<void> {
    const key = `${matchId}:${userId}`;
    const set = this.sockets.get(key) ?? new Set<string>();
    const wasEmpty = set.size === 0;
    set.add(socketId);
    this.sockets.set(key, set);
    const keys = this.keysBySocket.get(socketId) ?? new Set<string>();
    keys.add(key);
    this.keysBySocket.set(socketId, keys);
    if (wasEmpty) await this.setConnection(matchId, userId, true);
  }

  async socketLeft(matchId: string, userId: string, socketId: string): Promise<void> {
    await this.removeSocket(`${matchId}:${userId}`, socketId);
  }

  /** The socket closed: it leaves every match it was subscribed to. */
  async socketClosed(socketId: string): Promise<void> {
    for (const key of [...(this.keysBySocket.get(socketId) ?? [])]) {
      await this.removeSocket(key, socketId);
    }
  }

  private async removeSocket(key: string, socketId: string): Promise<void> {
    const set = this.sockets.get(key);
    this.keysBySocket.get(socketId)?.delete(key);
    if (this.keysBySocket.get(socketId)?.size === 0) this.keysBySocket.delete(socketId);
    if (!set || !set.delete(socketId)) return;
    if (set.size > 0) return;
    this.sockets.delete(key);
    const [matchId, userId] = key.split(':');
    try {
      await this.setConnection(matchId, userId, false);
    } catch (error) {
      this.logger.error(`Could not record disconnect: ${error instanceof Error ? error.message : error}`);
    }
  }

  // -------------------------------------------------------------------------
  // Presence
  // -------------------------------------------------------------------------

  private async setConnection(matchId: string, userId: string, connected: boolean): Promise<void> {
    const outcome = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      if (!(await lockMatch(tx, matchId))) return null;
      const m = await loadMatch(tx, matchId);
      if (!m || isTerminal(m.status)) return null;
      const player = m.players.find((p) => p.userId === userId);
      if (!player) return null;

      const now = new Date();
      const disconnectedAt = connected ? null : now;
      await tx.matchPlayer.update({
        where: { id: player.id },
        data: { connectionStatus: connected ? 'CONNECTED' : 'DISCONNECTED', disconnectedAt },
      });
      player.connectionStatus = connected ? 'CONNECTED' : 'DISCONNECTED';
      player.disconnectedAt = disconnectedAt;

      // 24-hour clock: runs while no player who is still in the game is connected.
      const someoneOnline = m.players.some((p) => !p.isBankrupt && p.connectionStatus === 'CONNECTED');
      let stateVersion = m.stateVersion;
      let broadcasts: MatchBroadcast[] = [];
      const everyoneOnline = m.players.filter((p) => !p.isBankrupt).every((p) => p.connectionStatus === 'CONNECTED');

      if (m.status === 'PAUSED' && everyoneOnline) {
        // Everyone still in the game is back: resume the exact same turn and phase.
        stateVersion += 1;
        await tx.match.update({
          where: { id: matchId },
          data: { status: 'IN_PROGRESS', pausedAt: null, pauseReason: null, stateVersion, allPlayersOfflineSince: null },
        });
        broadcasts = await appendEvents(
          tx,
          matchId,
          stateVersion,
          [{ type: 'game:resumed', actorPlayerId: null, payload: { matchId, stateVersion } }],
          now,
        );
      } else {
        await tx.match.update({
          where: { id: matchId },
          data: { allPlayersOfflineSince: someoneOnline ? null : m.allPlayersOfflineSince ?? now },
        });
      }
      return { playerId: player.id, disconnectedAt, stateVersion, broadcasts };
    });
    if (!outcome) return;

    this.realtime.toMatchUnsequenced(matchId, 'player:connection_changed', outcome.stateVersion, {
      playerId: outcome.playerId,
      connectionStatus: connected ? 'CONNECTED' : 'DISCONNECTED',
      disconnectedAt: outcome.disconnectedAt ? outcome.disconnectedAt.toISOString() : null,
    });
    this.realtime.toMatch(matchId, outcome.broadcasts);
    // A reconnecting player may be the first eligible host candidate.
    if (connected) await this.electHostIfNeeded(matchId);
  }

  /** After a restart no socket is connected, whatever the database says. */
  private async resetPresenceAfterRestart(): Promise<void> {
    const now = new Date();
    await this.prisma.matchPlayer.updateMany({
      where: { connectionStatus: 'CONNECTED', match: { status: { in: ACTIVE } } },
      data: { connectionStatus: 'DISCONNECTED', disconnectedAt: now },
    });
    await this.prisma.match.updateMany({
      where: { status: { in: ACTIVE }, allPlayersOfflineSince: null },
      data: { allPlayersOfflineSince: now },
    });
  }

  // -------------------------------------------------------------------------
  // Periodic sweep
  // -------------------------------------------------------------------------

  async sweep(): Promise<void> {
    if (this.sweeping) return;
    this.sweeping = true;
    try {
      const now = Date.now();
      const graceCutoff = new Date(now - config.disconnectGraceMs);

      // 1. Pause matches where a player has been offline for the whole grace period.
      const overdue = await this.prisma.matchPlayer.findMany({
        where: {
          isBankrupt: false,
          connectionStatus: 'DISCONNECTED',
          disconnectedAt: { lte: graceCutoff },
          match: { status: 'IN_PROGRESS' },
        },
        select: { matchId: true },
        distinct: ['matchId'],
      });
      for (const row of overdue) await this.guard(() => this.pauseIfOverdue(row.matchId));

      // 2. Host failover in active matches whose host has been offline for the grace period.
      const hostless = await this.prisma.matchPlayer.findMany({
        where: {
          connectionStatus: 'DISCONNECTED',
          disconnectedAt: { lte: graceCutoff },
          match: { status: { in: ACTIVE } },
        },
        select: { matchId: true },
        distinct: ['matchId'],
      });
      for (const row of hostless) await this.guard(() => this.electHostIfNeeded(row.matchId));

      // 3. Abandon matches where nobody has been online for 24 hours.
      const dead = await this.prisma.match.findMany({
        where: { status: { in: ACTIVE }, allPlayersOfflineSince: { lte: new Date(now - config.allOfflineAbandonMs) } },
        select: { id: true },
      });
      for (const row of dead) await this.guard(() => this.abandonIfAllOffline(row.id));
    } catch (error) {
      this.logger.error(`Lifecycle sweep failed: ${error instanceof Error ? error.message : error}`);
    } finally {
      this.sweeping = false;
    }
  }

  private async guard(task: () => Promise<void>): Promise<void> {
    try {
      await task();
    } catch (error) {
      this.logger.error(`Lifecycle task failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  private async pauseIfOverdue(matchId: string): Promise<void> {
    const broadcasts = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      if (!(await lockMatch(tx, matchId))) return [];
      const m = await loadMatch(tx, matchId);
      // Recheck inside the lock: the player may have reconnected a moment ago.
      if (!m || m.status !== 'IN_PROGRESS' || overduePlayerIds(m, Date.now()).length === 0) return [];
      const now = new Date();
      const stateVersion = m.stateVersion + 1;
      const reason = 'PLAYER_DISCONNECTED';
      await tx.match.update({
        where: { id: matchId },
        data: { status: 'PAUSED', pausedAt: now, pauseReason: reason, stateVersion },
      });
      return appendEvents(
        tx,
        matchId,
        stateVersion,
        [{ type: 'game:paused', actorPlayerId: null, payload: { pausedAt: now.toISOString(), reason } }],
        now,
      );
    });
    this.realtime.toMatch(matchId, broadcasts);
  }

  /**
   * If the room's host has been offline for the grace period, hand the role to the connected,
   * non-bankrupt player with the lowest seat. The former host never gets it back automatically.
   */
  async electHostIfNeeded(matchId: string): Promise<void> {
    const change = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      if (!(await lockMatch(tx, matchId))) return null;
      const m = await loadMatch(tx, matchId);
      if (!m || isTerminal(m.status)) return null;
      if (!(await lockRoom(tx, m.roomId))) return null;

      const host = m.players.find((p) => p.userId === m.room.hostUserId);
      const hostOverdue =
        !host ||
        (host.connectionStatus === 'DISCONNECTED' &&
          host.disconnectedAt !== null &&
          Date.now() - host.disconnectedAt.getTime() >= config.disconnectGraceMs);
      if (!hostOverdue) return null;

      const candidate = m.players.find((p) => !p.isBankrupt && p.connectionStatus === 'CONNECTED' && p.userId !== m.room.hostUserId);
      if (!candidate) return null; // keep the old host until someone eligible reconnects

      const room = await tx.room.update({
        where: { id: m.roomId },
        data: { hostUserId: candidate.userId, roomRevision: { increment: 1 } },
      });
      await tx.roomMember.updateMany({ where: { roomId: m.roomId, leftAt: null }, data: { isHost: false } });
      await tx.roomMember.updateMany({ where: { roomId: m.roomId, userId: candidate.userId, leftAt: null }, data: { isHost: true } });
      this.logger.log(`Host of room ${m.roomId} changed from ${m.room.hostUserId} to ${candidate.userId}`);
      return {
        roomId: m.roomId,
        stateVersion: m.stateVersion,
        payload: {
          roomId: m.roomId,
          previousHostUserId: m.room.hostUserId,
          newHostUserId: candidate.userId,
          roomRevision: room.roomRevision,
        },
      };
    });
    if (!change) return;

    this.realtime.toRoom(change.roomId, 'room:host_changed', change.payload);
    const room = await loadRoomState(this.prisma, change.roomId);
    if (room) this.realtime.toRoom(change.roomId, 'room:updated', room);
    // Players who only listen on the match channel learn about the new host too.
    this.realtime.toMatchUnsequenced(matchId, 'room:host_changed', change.stateVersion, change.payload);
  }

  private async abandonIfAllOffline(matchId: string): Promise<void> {
    const outcome = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      if (!(await lockMatch(tx, matchId))) return null;
      const m = await loadMatch(tx, matchId);
      if (!m || isTerminal(m.status) || !m.allPlayersOfflineSince) return null;
      if (Date.now() - m.allPlayersOfflineSince.getTime() < config.allOfflineAbandonMs) return null;
      const now = new Date();
      const stateVersion = m.stateVersion + 1;
      const result = abandonMatch(toEngineState(m), 'ALL_PLAYERS_OFFLINE_24H', {
        rng: { int: () => 0 },
        content: CONTENT,
        now: now.toISOString(),
        stateVersion,
      });
      await saveEngineState(tx, m, result.state, stateVersion, now);
      const broadcasts = await appendEvents(tx, matchId, stateVersion, result.events, now);
      return { roomId: m.roomId, broadcasts };
    });
    if (!outcome) return;
    this.logger.log(`Match ${matchId} abandoned: nobody online for 24 hours`);
    this.realtime.toMatch(matchId, outcome.broadcasts);
    const room = await loadRoomState(this.prisma, outcome.roomId);
    if (room) this.realtime.toRoom(outcome.roomId, 'room:updated', room);
  }
}
