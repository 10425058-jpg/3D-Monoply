import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import { AppError, conflict, forbidden, matchNotFound } from '../common/errors';
import { applyAction, createInitialState } from '../game/rules/engine';
import {
  ActionName,
  CONTENT_VERSION,
  EngineAction,
  EngineEvent,
  MAP_ID,
  Rng,
  RuleError,
  RULESET_ID,
} from '../game/rules/types';
import { PrismaService } from '../prisma/prisma.service';
import { MatchBroadcast, RealtimeService } from '../realtime/realtime.service';
import { loadRoomState, SEAT_PALETTE } from '../rooms/room-state';
import {
  appendEvents,
  CONTENT,
  everyoneConnected,
  isTerminal,
  loadMatch,
  lockMatch,
  overduePlayerIds,
  projectMatchState,
  PublicMatchState,
  saveEngineState,
  toEngineState,
} from './match-store';

/** Dice and shuffles use the operating system's secure random generator. */
const secureRng: Rng = { int: (maxExclusive) => randomInt(maxExclusive) };

const json = (value: unknown) => value as Prisma.InputJsonValue;

export interface ActionRequest {
  clientActionId: string;
  expectedStateVersion: number;
  contentVersion: string;
  spaceId?: number;
  cardId?: string;
  targetPlayerId?: string;
}

interface StartingMember {
  userId: string;
  seatOrder: number;
  username: string;
}

@Injectable()
export class MatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  /**
   * Creates the match for a room that is starting. Called by RoomsService inside its
   * transaction (the room row is already locked).
   */
  async createMatch(tx: Prisma.TransactionClient, roomId: string, members: StartingMember[]): Promise<{ matchId: string; stateVersion: number }> {
    const now = new Date();
    const match = await tx.match.create({
      data: {
        roomId,
        status: 'IN_PROGRESS',
        mapId: MAP_ID,
        rulesetId: RULESET_ID,
        contentVersion: CONTENT_VERSION,
        turnPhase: 'PRE_ROLL',
        // Nobody has opened a match socket yet. Each player has the normal grace period
        // to send match:join before the match pauses.
        allPlayersOfflineSince: now,
      },
    });

    const seats: Array<{ playerId: string; seatOrder: number }> = [];
    for (const member of members) {
      const palette = SEAT_PALETTE[member.seatOrder];
      const player = await tx.matchPlayer.create({
        data: {
          matchId: match.id,
          userId: member.userId,
          seatOrder: member.seatOrder,
          usernameSnapshot: member.username,
          token: palette.token,
          color: palette.color,
          connectionStatus: 'DISCONNECTED',
          disconnectedAt: now,
        },
      });
      seats.push({ playerId: player.id, seatOrder: member.seatOrder });
    }

    const state = createInitialState(seats, secureRng, CONTENT);
    await tx.match.update({ where: { id: match.id }, data: { currentPlayerId: state.currentPlayerId } });
    await tx.propertyOwnership.createMany({
      data: Object.keys(state.owners).map((spaceId) => ({ matchId: match.id, spaceId: Number(spaceId) })),
    });
    await tx.matchDeck.createMany({
      data: [
        { matchId: match.id, deckType: 'chance', orderedCardIds: json(state.decks.chance) },
        { matchId: match.id, deckType: 'chest', orderedCardIds: json(state.decks.chest) },
      ],
    });
    return { matchId: match.id, stateVersion: 0 };
  }

  /** GET /matches/:matchId — the viewer's personal snapshot. Participants only. */
  async getSnapshot(matchId: string, userId: string): Promise<PublicMatchState> {
    const m = await loadMatch(this.prisma, matchId);
    if (!m) throw matchNotFound();
    if (!m.players.some((p) => p.userId === userId)) throw forbidden('You are not a player in this match.');
    return projectMatchState(m, userId, Date.now());
  }

  /**
   * POST /matches/:matchId/actions/:action
   *
   * Order (docs/API-CONTRACT.md §4): authorize -> idempotency lookup -> content version ->
   * expected state version -> rules -> save state + processed action + events in ONE
   * transaction -> broadcast after commit.
   */
  async performAction(matchId: string, userId: string, action: ActionName, req: ActionRequest): Promise<unknown> {
    const requestHash = createHash('sha256')
      .update(JSON.stringify([action, req.expectedStateVersion, req.contentVersion, req.spaceId ?? null, req.cardId ?? null, req.targetPlayerId ?? null]))
      .digest('hex');

    const outcome = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        if (!(await lockMatch(tx, matchId))) throw matchNotFound();
        const m = await loadMatch(tx, matchId);
        if (!m) throw matchNotFound();
        const actor = m.players.find((p) => p.userId === userId);
        if (!actor) throw forbidden('You are not a player in this match.');

        // 1. Idempotency first: an exact retry gets the original response, even if the
        //    expectedStateVersion it carries is stale by now.
        const previous = await tx.processedAction.findUnique({
          where: { matchId_clientActionId: { matchId, clientActionId: req.clientActionId } },
        });
        if (previous) {
          if (previous.actorPlayerId === actor.id && previous.requestHash === requestHash) {
            return { response: previous.responseJson as unknown, broadcasts: [] as MatchBroadcast[], roomClosed: false, roomId: m.roomId };
          }
          throw conflict('INVALID_ACTION', 'This clientActionId was already used for a different request.');
        }

        // 2. New action: content version, terminal state, then expected version.
        if (req.contentVersion !== m.contentVersion) {
          throw conflict('CONTENT_VERSION_MISMATCH', 'Your game data is out of date. Reload the page.', {
            contentVersion: m.contentVersion,
          });
        }
        if (isTerminal(m.status)) throw conflict('MATCH_ALREADY_TERMINAL', 'This match has already ended.');
        if (req.expectedStateVersion !== m.stateVersion) {
          throw conflict('STATE_VERSION_CONFLICT', 'The match changed. Fetch the latest snapshot and try again.', {
            stateVersion: m.stateVersion,
          });
        }

        // 3. Host-only actions: authority and absence are rechecked here, inside the lock.
        const now = new Date();
        if (action === 'forfeit-player' || action === 'abandon') {
          if (m.room.hostUserId !== userId) throw forbidden('Only the host can do that.');
          if (actor.connectionStatus !== 'CONNECTED') throw forbidden('The host must be connected to do that.');
          if (action === 'forfeit-player' && !overduePlayerIds(m, now.getTime()).includes(req.targetPlayerId as string)) {
            throw conflict('PLAYER_NOT_ELIGIBLE_FOR_FORFEIT', 'That player cannot be removed right now.');
          }
        }

        // 4. Rules.
        const stateVersion = m.stateVersion + 1;
        const engineAction: EngineAction = {
          type: action,
          actorPlayerId: actor.id,
          spaceId: req.spaceId,
          cardId: req.cardId,
          targetPlayerId: req.targetPlayerId,
        };
        let result;
        try {
          result = applyAction(toEngineState(m), engineAction, {
            rng: secureRng,
            content: CONTENT,
            now: now.toISOString(),
            stateVersion,
          });
        } catch (error) {
          if (error instanceof RuleError) throw new AppError(409, error.code, error.message);
          throw error;
        }

        // A forfeit can remove the last absent player: resume straight away if everyone left is connected.
        const events: EngineEvent[] = result.events;
        if (result.state.status === 'PAUSED' && everyoneConnected(m, result.state)) {
          result.state.status = 'IN_PROGRESS';
          events.push({ type: 'game:resumed', actorPlayerId: null, payload: { matchId, stateVersion } });
        }

        // 5. Save everything together.
        const actionId = randomUUID();
        const response = {
          actionId,
          matchId,
          stateVersion,
          ...result.result,
          status: result.state.status,
          events: events.map((e) => ({ type: e.type, payload: e.payload })),
        };
        await saveEngineState(tx, m, result.state, stateVersion, now);
        const broadcasts = await appendEvents(tx, matchId, stateVersion, events, now);
        await tx.processedAction.create({
          data: {
            id: actionId,
            matchId,
            clientActionId: req.clientActionId,
            actorPlayerId: actor.id,
            requestHash,
            expectedStateVersion: req.expectedStateVersion,
            resultStateVersion: stateVersion,
            responseJson: json(response),
          },
        });
        return { response: response as unknown, broadcasts, roomClosed: isTerminal(result.state.status), roomId: m.roomId };
      },
      { maxWait: 10000, timeout: 15000 },
    );

    // 6. Broadcast only after the commit succeeded.
    this.realtime.toMatch(matchId, outcome.broadcasts);
    if (outcome.roomClosed) await this.broadcastRoom(outcome.roomId);
    return outcome.response;
  }

  /** Sends room:updated with the latest RoomState to the room's subscribers. */
  async broadcastRoom(roomId: string): Promise<void> {
    const room = await loadRoomState(this.prisma, roomId);
    if (room) this.realtime.toRoom(roomId, 'room:updated', room);
  }
}
