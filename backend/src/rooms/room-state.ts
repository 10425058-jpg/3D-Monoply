import { Prisma } from '@prisma/client';

/** Fixed seat palette (docs/GAME-STATE.md §4). Same tokens and colours as the local game. */
export const SEAT_PALETTE = [
  { token: 'rubber_duck', color: '#f59e0b' },
  { token: 'cat', color: '#ec4899' },
  { token: 'racecar', color: '#3b82f6' },
  { token: 'yacht', color: '#10b981' },
] as const;

export interface RoomMemberState {
  userId: string;
  username: string;
  avatarUrl: string | null;
  seatOrder: number;
  token: string;
  color: string;
  isReady: boolean;
  isHost: boolean;
}

export interface RoomState {
  roomId: string;
  roomRevision: number;
  status: string;
  hostUserId: string;
  mapId: string;
  maxPlayers: number;
  isPrivate: boolean;
  members: RoomMemberState[];
  matchId: string | null;
}

/** Locks the room row for the rest of the transaction. Returns false if the room does not exist. */
export async function lockRoom(tx: Prisma.TransactionClient, roomId: string): Promise<boolean> {
  const rows = (await tx.$queryRaw`SELECT id FROM rooms WHERE id = ${roomId}::uuid FOR UPDATE`) as unknown[];
  return rows.length > 0;
}

/** Public RoomState. Never contains the invite code. matchId is derived from matches.room_id. */
export async function loadRoomState(db: Prisma.TransactionClient, roomId: string): Promise<RoomState | null> {
  const room = await db.room.findUnique({
    where: { id: roomId },
    include: {
      members: {
        where: { leftAt: null },
        orderBy: { seatOrder: 'asc' },
        include: { user: { select: { username: true, avatarUrl: true } } },
      },
      match: { select: { id: true } },
    },
  });
  if (!room) return null;
  return {
    roomId: room.id,
    roomRevision: room.roomRevision,
    status: room.status,
    hostUserId: room.hostUserId,
    mapId: room.mapId,
    maxPlayers: room.maxPlayers,
    isPrivate: room.isPrivate,
    members: room.members.map((m) => ({
      userId: m.userId,
      username: m.user.username,
      avatarUrl: m.user.avatarUrl,
      seatOrder: m.seatOrder,
      token: m.token,
      color: m.color,
      isReady: m.isReady,
      isHost: m.isHost,
    })),
    matchId: room.match ? room.match.id : null,
  };
}
