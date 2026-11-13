import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { matchNotFound, validationError } from '../common/errors';
import { RateLimit } from '../common/rate-limit.guard';
import { body, int, isUuid, str, uuid } from '../common/validate';
import { ActionName, ACTION_NAMES } from '../game/rules/types';
import { ActionRequest, MatchesService } from './matches.service';

/** Extra body fields each action accepts, on top of the three common ones. */
const EXTRA_FIELDS: Record<ActionName, string[]> = {
  'roll-dice': [],
  'buy-property': ['spaceId'],
  'decline-property': ['spaceId'],
  'end-turn': [],
  'pay-jail-bail': [],
  'use-jail-card': ['cardId'],
  forfeit: [],
  'forfeit-player': ['targetPlayerId'],
  abandon: [],
};

@Controller('matches')
@UseGuards(AuthGuard)
export class MatchesController {
  constructor(private readonly matches: MatchesService) {}

  @Get(':matchId')
  snapshot(@Param('matchId') matchId: string, @UserId() userId: string) {
    if (!isUuid(matchId)) throw matchNotFound();
    return this.matches.getSnapshot(matchId, userId);
  }

  /**
   * Every match mutation. The body always carries clientActionId (UUID),
   * expectedStateVersion and contentVersion. The client never sends dice, money or positions.
   */
  @Post(':matchId/actions/:action')
  @HttpCode(200)
  @RateLimit(120, 60)
  act(@Param('matchId') matchId: string, @Param('action') action: string, @UserId() userId: string, @Body() raw: unknown) {
    if (!isUuid(matchId)) throw matchNotFound();
    if (!ACTION_NAMES.includes(action as ActionName)) throw validationError(`Unknown action "${action}".`);
    const name = action as ActionName;
    const extra = EXTRA_FIELDS[name];
    const b = body(raw, ['clientActionId', 'expectedStateVersion', 'contentVersion', ...extra]);

    const request: ActionRequest = {
      clientActionId: uuid(b.clientActionId, 'clientActionId'),
      expectedStateVersion: int(b.expectedStateVersion, 'expectedStateVersion', 0, 2147483647),
      contentVersion: str(b.contentVersion, 'contentVersion', { max: 80 }),
    };
    if (extra.includes('spaceId')) request.spaceId = int(b.spaceId, 'spaceId', 0, 39);
    if (extra.includes('cardId')) request.cardId = str(b.cardId, 'cardId', { max: 64 });
    if (extra.includes('targetPlayerId')) request.targetPlayerId = uuid(b.targetPlayerId, 'targetPlayerId');

    return this.matches.performAction(matchId.toLowerCase(), userId, name, request);
  }
}
