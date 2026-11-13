import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { mapUniqueViolation, toPublicUser } from '../auth/auth.service';
import { unauthorized, validationError } from '../common/errors';
import { body, optionalStr } from '../common/validate';
import { PrismaService } from '../prisma/prisma.service';

@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('me')
  async me(@UserId() userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw unauthorized();
    return toPublicUser(user);
  }

  /** Only username and avatarUrl can be changed. Anything else in the body is rejected. */
  @Patch('me')
  async update(@UserId() userId: string, @Body() raw: unknown) {
    const b = body(raw, ['username', 'avatarUrl']);
    const username = optionalStr(b.username, 'username', { min: 3, max: 24, pattern: /^[A-Za-z0-9_]+$/ });
    let avatarUrl: string | null | undefined;
    if (b.avatarUrl === null) avatarUrl = null;
    else avatarUrl = optionalStr(b.avatarUrl, 'avatarUrl', { min: 1, max: 2048, pattern: /^https:\/\/\S+$/ });
    if (username === undefined && avatarUrl === undefined) throw validationError('Nothing to update.');
    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: { ...(username !== undefined ? { username } : {}), ...(avatarUrl !== undefined ? { avatarUrl } : {}) },
      });
      return toPublicUser(user);
    } catch (error) {
      throw mapUniqueViolation(error);
    }
  }
}
