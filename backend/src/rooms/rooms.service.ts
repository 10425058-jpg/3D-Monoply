import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomToken, safeEqualHex, sha256 } from '../auth/tokens';
import { conflict, forbidden, roomNotFound } from '../common/errors';
import { CONTENT_VERSION, MAP_ID, RULESET_ID } from '../game/rules/types';
import { MatchesService } from '../matches/matches.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { loadRoomState, lockRoom, RoomState, SEAT_PALETTE } from './room-state';

type Tx = Prisma.TransactionClient;

const notWaiting = (status: string) =>
  status === 'CLOSED'
    ? conflict('ROOM_CLOSED', 'This room is closed. Create a new room to play again.')
    : conflict('ROOM_ALREADY_STARTED', 'This room has already started its match.');

/** 16 random bytes, base64url. Shown to the host once; only its hash is stored. */
const newInviteCode = () => randomToken(16);

@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly matches: MatchesService,
  ) {}

  /** GET /rooms — public WAITING rooms only, newest first. */
  async list(limit: number, cursor: string | undefined) {
    const rooms = await this.prisma.room.findMany({
      where: { status: 'WAITING', isPrivate: false },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { _count: { select: { members: { where: { leftAt: null } } } } },
    });
    const page = rooms.slice(0, limit);
    return {
      items: page.map((r) => ({
        roomId: r.id,
        mapId: r.mapId,
        memberCount: r._count.members,
        maxPlayers: r.maxPlayers,
        status: r.status,
      })),
      nextCursor: rooms.length > limit ? page[page.length - 1].id : null,
    };
  }

  /** POST /rooms — the creator becomes host in seat 0. */
  async create(userId: string, maxPlayers: number, isPrivate: boolean): Promise<{ room: RoomState; inviteCode?: string }> {
    const inviteCode = isPrivate ? newInviteCode() : undefined;
    const roomId = await this.prisma.$transaction(async (tx: Tx) => {
      const room = await tx.room.create({
        data: {
          hostUserId: userId,
          status: 'WAITING',
          mapId: MAP_ID,
          maxPlayers,
          isPrivate,
          inviteCodeHash: inviteCode ? sha256(inviteCode) : null,
        },
      });
      await tx.roomMember.create({
        data: { roomId: room.id, userId, seatOrder: 0, ...SEAT_PALETTE[0], isHost: true, isReady: true },
      });
      return room.id;
    });
    const room = (await loadRoomState(this.prisma, roomId)) as RoomState;
    return inviteCode ? { room, inviteCode } : { room };
  }

  /** GET /rooms/:roomId and the socket room:join check — members only. */
  async getForMember(roomId: string, userId: string): Promise<RoomState> {
    const room = await loadRoomState(this.prisma, roomId);
    if (!room) throw roomNotFound();
    if (!room.members.some((m) => m.userId === userId)) throw forbidden('You are not a member of this room.');
    return room;
  }

  /** POST /rooms/:roomId/join — takes the lowest free seat. */
  async join(roomId: string, userId: string, inviteCode: string | undefined): Promise<RoomState> {
    const result = await this.prisma.$transaction(async (tx: Tx) => {
      const room = await this.lockAndLoad(tx, roomId);
      const members = await tx.roomMember.findMany({ where: { roomId, leftAt: null } });
      if (members.some((m) => m.userId === userId)) return { changed: false }; // already in: idempotent
      if (room.status !== 'WAITING') throw notWaiting(room.status);
      if (room.isPrivate) {
        const ok = !!inviteCode && !!room.inviteCodeHash && safeEqualHex(room.inviteCodeHash, sha256(inviteCode));
        if (!ok) throw conflict('INVALID_INVITE_CODE', 'That invite code is not valid.');
      }
      if (members.length >= room.maxPlayers) throw conflict('ROOM_FULL', 'This room is full.');
      const taken = new Set(members.map((m) => m.seatOrder));
      let seatOrder = 0;
      while (taken.has(seatOrder)) seatOrder += 1;
      await tx.roomMember.create({ data: { roomId, userId, seatOrder, ...SEAT_PALETTE[seatOrder] } });
      await this.bump(tx, roomId);
      return { changed: true };
    });
    return this.afterChange(roomId, result.changed);
  }

  /** POST /rooms/:roomId/leave — only before the match starts. Host role passes to the oldest member. */
  async leave(roomId: string, userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx: Tx) => {
      const room = await this.lockAndLoad(tx, roomId);
      const members = await tx.roomMember.findMany({ where: { roomId, leftAt: null }, orderBy: { joinedAt: 'asc' } });
      const me = members.find((m) => m.userId === userId);
      if (!me) throw forbidden('You are not a member of this room.');
      if (room.status === 'IN_PROGRESS') {
        throw conflict('ROOM_ALREADY_STARTED', 'The match has started. Use the forfeit action to leave the game.');
      }
      if (room.status !== 'WAITING') throw notWaiting(room.status);

      await tx.roomMember.update({ where: { id: me.id }, data: { leftAt: new Date(), isHost: false, isReady: false } });
      const remaining = members.filter((m) => m.id !== me.id);
      if (remaining.length === 0) {
        await tx.room.update({ where: { id: roomId }, data: { status: 'CLOSED', roomRevision: { increment: 1 } } });
        return;
      }
      if (room.hostUserId === userId) {
        const next = remaining[0]; // longest-present active member
        await tx.roomMember.update({ where: { id: next.id }, data: { isHost: true, isReady: true } });
        await tx.room.update({ where: { id: roomId }, data: { hostUserId: next.userId, roomRevision: { increment: 1 } } });
        return;
      }
      await this.bump(tx, roomId);
    });
    await this.afterChange(roomId, true);
  }

  /** PATCH /rooms/:roomId/ready — the host is always ready. */
  async setReady(roomId: string, userId: string, isReady: boolean): Promise<RoomState> {
    await this.prisma.$transaction(async (tx: Tx) => {
      const room = await this.lockAndLoad(tx, roomId);
      const me = await tx.roomMember.findFirst({ where: { roomId, userId, leftAt: null } });
      if (!me) throw forbidden('You are not a member of this room.');
      if (room.status !== 'WAITING') throw notWaiting(room.status);
      await tx.roomMember.update({ where: { id: me.id }, data: { isReady: me.isHost ? true : isReady } });
      await this.bump(tx, roomId);
    });
    return this.afterChange(roomId, true);
  }

  /** POST /rooms/:roomId/invite/rotate — host only. The old code stops working immediately. */
  async rotateInvite(roomId: string, userId: string): Promise<{ inviteCode: string }> {
    const inviteCode = newInviteCode();
    await this.prisma.$transaction(async (tx: Tx) => {
      const room = await this.lockAndLoad(tx, roomId);
      if (room.hostUserId !== userId) throw forbidden('Only the host can do that.');
      if (room.status !== 'WAITING') throw notWaiting(room.status);
      if (!room.isPrivate) throw conflict('INVALID_ACTION', 'Only private rooms have invite codes.');
      await tx.room.update({ where: { id: roomId }, data: { inviteCodeHash: sha256(inviteCode) } });
    });
    return { inviteCode };
  }

  /** POST /rooms/:roomId/start — host only, 2-4 members, everyone else ready. */
  async start(roomId: string, userId: string, contentVersion: string) {
    const started = await this.prisma.$transaction(async (tx: Tx) => {
      const room = await this.lockAndLoad(tx, roomId);
      if (room.hostUserId !== userId) throw forbidden('Only the host can start the match.');
      if (room.status !== 'WAITING') throw notWaiting(room.status);
      if (contentVersion !== CONTENT_VERSION) {
        throw conflict('CONTENT_VERSION_MISMATCH', 'Your game data is out of date. Reload the page.', {
          contentVersion: CONTENT_VERSION,
        });
      }
      const members = await tx.roomMember.findMany({
        where: { roomId, leftAt: null },
        orderBy: { seatOrder: 'asc' },
        include: { user: { select: { username: true } } },
      });
      if (members.length < 2) throw conflict('INVALID_ACTION', 'At least 2 players are needed to start.');
      if (members.some((m) => !m.isHost && !m.isReady)) throw conflict('INVALID_ACTION', 'Not every player is ready.');

      const match = await this.matches.createMatch(
        tx,
        roomId,
        members.map((m) => ({ userId: m.userId, seatOrder: m.seatOrder, username: m.user.username })),
      );
      await tx.room.update({ where: { id: roomId }, data: { status: 'IN_PROGRESS', roomRevision: { increment: 1 } } });
      return match;
    });

    await this.afterChange(roomId, true);
    // Lobby subscribers get the ids only; each player then fetches a personal snapshot.
    this.realtime.toRoom(roomId, 'match:started', { matchId: started.matchId, stateVersion: started.stateVersion });
    return { matchId: started.matchId, stateVersion: started.stateVersion, status: 'IN_PROGRESS', mapId: MAP_ID, rulesetId: RULESET_ID };
  }

  // -------------------------------------------------------------------------

  /** Locks the room row so membership, seats and host cannot change underneath us. */
  private async lockAndLoad(tx: Tx, roomId: string) {
    if (!(await lockRoom(tx, roomId))) throw roomNotFound();
    const room = await tx.room.findUnique({ where: { id: roomId } });
    if (!room) throw roomNotFound();
    return room;
  }

  private async bump(tx: Tx, roomId: string): Promise<void> {
    await tx.room.update({ where: { id: roomId }, data: { roomRevision: { increment: 1 } } });
  }

  /** Reloads the room after commit and tells lobby subscribers when something changed. */
  private async afterChange(roomId: string, changed: boolean): Promise<RoomState> {
    const room = await loadRoomState(this.prisma, roomId);
    if (!room) throw roomNotFound();
    if (changed) this.realtime.toRoom(roomId, 'room:updated', room);
    return room;
  }
}
