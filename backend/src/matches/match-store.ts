// Reading and writing matches. Plain functions that take a Prisma client or transaction,
// shared by MatchesService (player actions) and LifecycleService (pause, resume, host, abandon).

import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { config } from '../config';
import { CONTENT } from '../game/content';
import { allowedActions, netWorth } from '../game/rules/engine';
import { ActionName, DeckType, DiceState, EngineEvent, EngineState, LastCardResolved } from '../game/rules/types';
import { MatchBroadcast } from '../realtime/realtime.service';

type Db = Prisma.TransactionClient;

const json = (value: unknown) => value as Prisma.InputJsonValue;

export const isTerminal = (status: string) => status === 'FINISHED' || status === 'ABANDONED';

/** Locks the match row for the rest of the transaction, so actions on one match run one at a time. */
export async function lockMatch(tx: Db, matchId: string): Promise<boolean> {
  const rows = (await tx.$queryRaw`SELECT id FROM matches WHERE id = ${matchId}::uuid FOR UPDATE`) as unknown[];
  return rows.length > 0;
}

export async function loadMatch(db: Db, matchId: string) {
  return db.match.findUnique({
    where: { id: matchId },
    include: {
      room: true,
      players: { orderBy: { seatOrder: 'asc' }, include: { user: { select: { avatarUrl: true } } } },
      ownerships: { orderBy: { spaceId: 'asc' } },
      decks: true,
    },
  });
}

export type LoadedMatch = NonNullable<Awaited<ReturnType<typeof loadMatch>>>;

const stringArray = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []);

/** Database rows -> rules-engine state (includes the secret deck order). */
export function toEngineState(m: LoadedMatch): EngineState {
  const owners: Record<number, string | null> = {};
  for (const o of m.ownerships) owners[o.spaceId] = o.ownerPlayerId;
  const deck = (type: DeckType) => m.decks.find((d) => d.deckType === type);
  return {
    status: m.status as EngineState['status'],
    players: m.players.map((p) => ({
      playerId: p.id,
      seatOrder: p.seatOrder,
      position: p.position,
      money: p.money,
      inJail: p.inJail,
      jailTurns: p.jailTurns,
      heldJailCardIds: stringArray(p.heldJailCardIds),
      isBankrupt: p.isBankrupt,
      finalRank: p.finalRank,
    })),
    owners,
    currentPlayerId: m.currentPlayerId,
    turnNumber: m.turnNumber,
    completedTurns: m.completedTurns,
    turnPhase: m.turnPhase as EngineState['turnPhase'],
    dice: (m.diceState as unknown as DiceState | null) ?? null,
    doublesCount: m.doublesCount,
    pendingExtraRoll: m.pendingExtraRoll,
    pendingPurchaseSpaceId: m.pendingPurchaseSpaceId,
    lastCardResolved: (m.lastCardResolved as unknown as LastCardResolved | null) ?? null,
    winnerPlayerId: m.winnerPlayerId,
    finishReason: m.finishReason as EngineState['finishReason'],
    decks: {
      chance: stringArray(deck('chance')?.orderedCardIds),
      chest: stringArray(deck('chest')?.orderedCardIds),
    },
    drawCounts: {
      chance: deck('chance')?.drawCursor ?? 0,
      chest: deck('chest')?.drawCursor ?? 0,
    },
  };
}

/**
 * Writes a new engine state over the rows loaded in `before`.
 * Must run in the same transaction that locked the match.
 */
export async function saveEngineState(tx: Db, before: LoadedMatch, next: EngineState, stateVersion: number, now: Date): Promise<void> {
  const ended = isTerminal(next.status);
  const paused = next.status === 'PAUSED';
  await tx.match.update({
    where: { id: before.id },
    data: {
      status: next.status,
      currentPlayerId: next.currentPlayerId,
      turnNumber: next.turnNumber,
      completedTurns: next.completedTurns,
      turnPhase: next.turnPhase,
      stateVersion,
      diceState: next.dice ? json(next.dice) : Prisma.DbNull,
      lastCardResolved: next.lastCardResolved ? json(next.lastCardResolved) : Prisma.DbNull,
      doublesCount: next.doublesCount,
      pendingExtraRoll: next.pendingExtraRoll,
      pendingPurchaseSpaceId: next.pendingPurchaseSpaceId,
      winnerPlayerId: next.winnerPlayerId,
      finishReason: next.finishReason,
      pausedAt: paused ? before.pausedAt : null,
      pauseReason: paused ? before.pauseReason : null,
      endedAt: ended ? now : null,
    },
  });

  for (const p of next.players) {
    await tx.matchPlayer.update({
      where: { id: p.playerId },
      data: {
        position: p.position,
        money: p.money,
        inJail: p.inJail,
        jailTurns: p.jailTurns,
        heldJailCardIds: json(p.heldJailCardIds),
        isBankrupt: p.isBankrupt,
        finalRank: p.finalRank,
      },
    });
  }

  for (const o of before.ownerships) {
    const owner = next.owners[o.spaceId] ?? null;
    if (owner !== o.ownerPlayerId) {
      await tx.propertyOwnership.update({ where: { id: o.id }, data: { ownerPlayerId: owner } });
    }
  }

  for (const d of before.decks) {
    const type = d.deckType as DeckType;
    await tx.matchDeck.update({
      where: { id: d.id },
      data: { orderedCardIds: json(next.decks[type]), drawCursor: next.drawCounts[type] },
    });
  }

  if (ended) {
    // Terminal match closes its room in the same transaction (no rematch in the same room).
    await tx.room.update({ where: { id: before.roomId }, data: { status: 'CLOSED', roomRevision: { increment: 1 } } });
  }
}

/** Appends events to the ordered log and returns the envelopes to broadcast after commit. */
export async function appendEvents(tx: Db, matchId: string, stateVersion: number, events: EngineEvent[], now: Date): Promise<MatchBroadcast[]> {
  if (events.length === 0) return [];
  const last = await tx.gameEvent.aggregate({ where: { matchId }, _max: { sequence: true } });
  let sequence = last._max.sequence ?? 0;
  const rows = events.map((e) => ({
    id: randomUUID(),
    matchId,
    sequence: ++sequence,
    stateVersion,
    actorPlayerId: e.actorPlayerId,
    eventType: e.type,
    payload: json(e.payload),
    createdAt: now,
  }));
  await tx.gameEvent.createMany({ data: rows });
  return rows.map((r, i) => ({
    event: r.eventType,
    envelope: {
      eventId: r.id,
      occurredAt: now.toISOString(),
      matchId,
      stateVersion,
      sequence: r.sequence,
      payload: events[i].payload,
    },
  }));
}

/** Players the host may remove right now: not eliminated and offline for the whole grace period. */
export function overduePlayerIds(m: LoadedMatch, nowMs: number): string[] {
  return m.players
    .filter(
      (p) =>
        !p.isBankrupt &&
        p.connectionStatus === 'DISCONNECTED' &&
        p.disconnectedAt !== null &&
        nowMs - p.disconnectedAt.getTime() >= config.disconnectGraceMs,
    )
    .map((p) => p.id);
}

/** True when every player still in the game is connected. */
export function everyoneConnected(m: LoadedMatch, state: EngineState): boolean {
  const alive = new Set(state.players.filter((p) => !p.isBankrupt).map((p) => p.playerId));
  return m.players.filter((p) => alive.has(p.id)).every((p) => p.connectionStatus === 'CONNECTED');
}

export interface PublicMatchState {
  matchId: string;
  roomId: string;
  status: string;
  mapId: string;
  rulesetId: string;
  contentVersion: string;
  players: Array<Record<string, unknown>>;
  properties: Array<{ spaceId: number; ownerPlayerId: string | null; houses: number; isMortgaged: boolean }>;
  currentPlayerId: string | null;
  turnNumber: number;
  completedTurns: number;
  turnPhase: string;
  dice: DiceState | null;
  doublesCount: number;
  pendingExtraRoll: boolean;
  pendingPurchaseSpaceId: number | null;
  lastCardResolved: LastCardResolved | null;
  allowedActions: ActionName[];
  winnerPlayerId: string | null;
  finishReason: string | null;
  stateVersion: number;
  pausedAt: string | null;
  pauseReason: string | null;
  allPlayersOfflineSince: string | null;
  startedAt: string;
  updatedAt: string;
  standings: Array<{ playerId: string; rank: number; money: number; netWorth: number }>;
}

const iso = (d: Date | null) => (d ? d.toISOString() : null);

/**
 * The public MatchState for ONE viewer (docs/GAME-STATE.md §2).
 * Contains that viewer's allowedActions and never the deck order.
 */
export function projectMatchState(m: LoadedMatch, viewerUserId: string, nowMs: number): PublicMatchState {
  const state = toEngineState(m);
  const viewer = m.players.find((p) => p.userId === viewerUserId);
  const isConnectedHost = !!viewer && m.room.hostUserId === viewerUserId && viewer.connectionStatus === 'CONNECTED';
  return {
    matchId: m.id,
    roomId: m.roomId,
    status: m.status,
    mapId: m.mapId,
    rulesetId: m.rulesetId,
    contentVersion: m.contentVersion,
    players: m.players.map((p) => ({
      playerId: p.id,
      userId: p.userId,
      username: p.usernameSnapshot,
      avatarUrl: p.user.avatarUrl,
      token: p.token,
      color: p.color,
      seatOrder: p.seatOrder,
      position: p.position,
      money: p.money,
      inJail: p.inJail,
      jailTurns: p.jailTurns,
      heldJailCardIds: stringArray(p.heldJailCardIds),
      isBankrupt: p.isBankrupt,
      connectionStatus: p.connectionStatus,
      disconnectedAt: iso(p.disconnectedAt),
    })),
    properties: m.ownerships.map((o) => ({
      spaceId: o.spaceId,
      ownerPlayerId: o.ownerPlayerId,
      houses: o.houses,
      isMortgaged: o.isMortgaged,
    })),
    currentPlayerId: m.currentPlayerId,
    turnNumber: m.turnNumber,
    completedTurns: m.completedTurns,
    turnPhase: m.turnPhase,
    dice: state.dice,
    doublesCount: m.doublesCount,
    pendingExtraRoll: m.pendingExtraRoll,
    pendingPurchaseSpaceId: m.pendingPurchaseSpaceId,
    lastCardResolved: state.lastCardResolved,
    allowedActions: allowedActions(state, viewer ? viewer.id : null, {
      isConnectedHost,
      eligibleForfeitTargetIds: overduePlayerIds(m, nowMs),
    }),
    winnerPlayerId: m.winnerPlayerId,
    finishReason: m.finishReason,
    stateVersion: m.stateVersion,
    pausedAt: iso(m.pausedAt),
    pauseReason: m.pauseReason,
    allPlayersOfflineSince: iso(m.allPlayersOfflineSince),
    startedAt: m.startedAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
    // The terminal event may be missed. Persisted ranks must survive page reloads.
    standings: m.status === 'FINISHED' ? state.players
      .map((p) => ({ playerId: p.playerId, rank: p.finalRank ?? 0, money: p.money, netWorth: netWorth(state, p, CONTENT) }))
      .sort((a, b) => a.rank - b.rank) : [],
  };
}

/** The catalog this server runs. Re-exported so services do not import content directly. */
export { CONTENT };
