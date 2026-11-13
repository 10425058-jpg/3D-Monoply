import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { AppError, conflict, unauthorized } from '../common/errors';
import { config } from '../config';
import { PrismaService } from '../prisma/prisma.service';
import { randomToken, safeEqualHex, sha256 } from './tokens';

const BCRYPT_ROUNDS = 12;

export interface PublicUser {
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  createdAt: string;
}

export interface SessionTokens {
  accessToken: string;
  expiresIn: number;
  csrfToken: string;
  /** Raw refresh token. Goes into the HttpOnly cookie only, never into JSON. */
  refreshToken: string;
}

export function toPublicUser(u: { id: string; username: string; email: string; avatarUrl: string | null; createdAt: Date }): PublicUser {
  return { id: u.id, username: u.username, email: u.email, avatarUrl: u.avatarUrl, createdAt: u.createdAt.toISOString() };
}

const csrfInvalid = () => new AppError(403, 'CSRF_INVALID', 'CSRF check failed.');

@Injectable()
export class AuthService {
  /** Compared against when the email is unknown, so both cases take the same time. */
  private readonly dummyHash = bcrypt.hashSync(randomToken(), BCRYPT_ROUNDS);

  constructor(private readonly prisma: PrismaService) {}

  async register(username: string, email: string, password: string): Promise<{ user: PublicUser; tokens: SessionTokens }> {
    const normalizedEmail = email.toLowerCase();
    if (await this.prisma.user.findUnique({ where: { username } })) {
      throw conflict('USERNAME_TAKEN', 'That username is already taken.');
    }
    if (await this.prisma.user.findUnique({ where: { email: normalizedEmail } })) {
      throw conflict('EMAIL_TAKEN', 'That email is already registered.');
    }
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    try {
      const user = await this.prisma.user.create({ data: { username, email: normalizedEmail, passwordHash } });
      return { user: toPublicUser(user), tokens: await this.createSession(user.id, null) };
    } catch (error) {
      throw mapUniqueViolation(error);
    }
  }

  async login(email: string, password: string): Promise<{ user: PublicUser; tokens: SessionTokens }> {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    // Always run bcrypt so the response time does not reveal whether the email exists.
    const ok = await bcrypt.compare(password, user?.passwordHash ?? this.dummyHash);
    if (!user || !ok) throw new AppError(401, 'INVALID_CREDENTIALS', 'Wrong email or password.');
    return { user: toPublicUser(user), tokens: await this.createSession(user.id, null) };
  }

  /** Rotates the refresh token and CSRF token; the old session is revoked in the same transaction. */
  async refresh(refreshToken: string | undefined, csrfToken: string | undefined): Promise<SessionTokens> {
    const session = await this.requireSession(refreshToken);
    this.requireCsrf(session.csrfTokenHash, csrfToken);
    return this.createSession(session.userId, session.id);
  }

  async logout(refreshToken: string | undefined, csrfToken: string | undefined): Promise<void> {
    const session = await this.requireSession(refreshToken);
    this.requireCsrf(session.csrfTokenHash, csrfToken);
    await this.prisma.userSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
  }

  /** After a page reload the in-memory CSRF token is gone: issue a fresh one for the same session. */
  async issueCsrfToken(refreshToken: string | undefined): Promise<string> {
    const session = await this.requireSession(refreshToken);
    const csrfToken = randomToken();
    await this.prisma.userSession.update({ where: { id: session.id }, data: { csrfTokenHash: sha256(csrfToken) } });
    return csrfToken;
  }

  /** Verifies a 15-minute access JWT. Returns the user id and the expiry (seconds since epoch). */
  verifyAccessToken(token: string | undefined): { userId: string; exp: number } {
    if (!token) throw unauthorized();
    try {
      const payload = jwt.verify(token, config.jwtAccessSecret, { algorithms: ['HS256'] });
      if (typeof payload === 'string' || typeof payload.sub !== 'string' || typeof payload.exp !== 'number') {
        throw unauthorized();
      }
      return { userId: payload.sub, exp: payload.exp };
    } catch {
      throw unauthorized('Your session has expired. Refresh and try again.');
    }
  }

  private async requireSession(refreshToken: string | undefined) {
    if (!refreshToken) throw unauthorized();
    const session = await this.prisma.userSession.findUnique({ where: { refreshTokenHash: sha256(refreshToken) } });
    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) throw unauthorized();
    return session;
  }

  private requireCsrf(expectedHash: string, csrfToken: string | undefined): void {
    if (!csrfToken || !safeEqualHex(expectedHash, sha256(csrfToken))) throw csrfInvalid();
  }

  private async createSession(userId: string, rotatedFromId: string | null): Promise<SessionTokens> {
    const refreshToken = randomToken();
    const csrfToken = randomToken();
    const expiresAt = new Date(Date.now() + config.refreshTokenTtlMs);

    const session = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      if (rotatedFromId) {
        // Only one request may rotate a given session; a second one finds it already revoked.
        const revoked = await tx.userSession.updateMany({
          where: { id: rotatedFromId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        if (revoked.count !== 1) throw unauthorized();
      }
      return tx.userSession.create({
        data: {
          userId,
          refreshTokenHash: sha256(refreshToken),
          csrfTokenHash: sha256(csrfToken),
          rotatedFromId,
          expiresAt,
        },
      });
    });

    const accessToken = jwt.sign({ sid: session.id }, config.jwtAccessSecret, {
      algorithm: 'HS256',
      subject: userId,
      expiresIn: config.accessTokenTtlSeconds,
    });
    return { accessToken, expiresIn: config.accessTokenTtlSeconds, csrfToken, refreshToken };
  }
}

/** Turns a database unique-constraint error on users into USERNAME_TAKEN / EMAIL_TAKEN. */
export function mapUniqueViolation(error: unknown): unknown {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    const target = JSON.stringify(error.meta?.target ?? '');
    if (target.includes('email')) return conflict('EMAIL_TAKEN', 'That email is already registered.');
    return conflict('USERNAME_TAKEN', 'That username is already taken.');
  }
  return error;
}
