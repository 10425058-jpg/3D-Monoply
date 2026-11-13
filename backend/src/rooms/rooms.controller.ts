import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { roomNotFound, validationError } from '../common/errors';
import { RateLimit } from '../common/rate-limit.guard';
import { body, bool, int, isUuid, literal, optionalStr } from '../common/validate';
import { MAP_ID, RULESET_ID } from '../game/rules/types';
import { RoomsService } from './rooms.service';

function roomId(value: string): string {
  if (!isUuid(value)) throw roomNotFound();
  return value.toLowerCase();
}

@Controller('rooms')
@UseGuards(AuthGuard)
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Get()
  list(@Query('limit') limitRaw?: string, @Query('cursor') cursor?: string) {
    const limit = limitRaw === undefined ? 20 : Number(limitRaw);
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw validationError('limit must be 1-50.');
    if (cursor !== undefined && !isUuid(cursor)) throw validationError('cursor is not valid.');
    return this.rooms.list(limit, cursor);
  }

  @Post()
  @RateLimit(20, 60)
  create(@UserId() userId: string, @Body() raw: unknown) {
    const b = body(raw, ['mapId', 'maxPlayers', 'isPrivate']);
    literal(b.mapId, 'mapId', MAP_ID);
    const maxPlayers = b.maxPlayers === undefined ? 4 : int(b.maxPlayers, 'maxPlayers', 2, 4);
    const isPrivate = b.isPrivate === undefined ? false : bool(b.isPrivate, 'isPrivate');
    return this.rooms.create(userId, maxPlayers, isPrivate);
  }

  @Get(':roomId')
  get(@Param('roomId') id: string, @UserId() userId: string) {
    return this.rooms.getForMember(roomId(id), userId);
  }

  @Post(':roomId/join')
  @HttpCode(200)
  @RateLimit(20, 60)
  join(@Param('roomId') id: string, @UserId() userId: string, @Body() raw: unknown) {
    const b = body(raw ?? {}, ['inviteCode']);
    return this.rooms.join(roomId(id), userId, optionalStr(b.inviteCode, 'inviteCode', { max: 128 }));
  }

  @Post(':roomId/leave')
  @HttpCode(200)
  async leave(@Param('roomId') id: string, @UserId() userId: string) {
    await this.rooms.leave(roomId(id), userId);
    return { success: true };
  }

  @Patch(':roomId/ready')
  ready(@Param('roomId') id: string, @UserId() userId: string, @Body() raw: unknown) {
    const b = body(raw, ['isReady']);
    return this.rooms.setReady(roomId(id), userId, bool(b.isReady, 'isReady'));
  }

  @Post(':roomId/invite/rotate')
  @HttpCode(200)
  @RateLimit(10, 60)
  rotateInvite(@Param('roomId') id: string, @UserId() userId: string) {
    return this.rooms.rotateInvite(roomId(id), userId);
  }

  @Post(':roomId/start')
  @RateLimit(10, 60)
  start(@Param('roomId') id: string, @UserId() userId: string, @Body() raw: unknown) {
    const b = body(raw, ['rulesetId', 'contentVersion']);
    literal(b.rulesetId, 'rulesetId', RULESET_ID);
    // A wrong contentVersion is a 409 CONTENT_VERSION_MISMATCH (checked in the service), not a 400.
    const contentVersion = typeof b.contentVersion === 'string' ? b.contentVersion : '';
    return this.rooms.start(roomId(id), userId, contentVersion);
  }
}
