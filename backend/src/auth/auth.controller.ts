import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppError } from '../common/errors';
import { RateLimit } from '../common/rate-limit.guard';
import { body, str } from '../common/validate';
import { config } from '../config';
import { AuthService, SessionTokens } from './auth.service';

const USERNAME = /^[A-Za-z0-9_]+$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index > 0 && part.slice(0, index).trim() === name) {
      try {
        return decodeURIComponent(part.slice(index + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

function headerValue(req: Request, name: string): string | undefined {
  const value = req.headers[name];
  return typeof value === 'string' ? value : undefined;
}

/**
 * Cookie-authenticated routes only accept requests from our own frontend.
 * Browsers always send Origin on cross-origin and on POST requests.
 */
function requireTrustedOrigin(req: Request, allowMissingForSameOrigin: boolean): void {
  const origin = headerValue(req, 'origin');
  if (origin) {
    if (!config.corsOrigins.includes(origin)) throw new AppError(403, 'CSRF_INVALID', 'Origin not allowed.');
    return;
  }
  const sameOrigin = headerValue(req, 'sec-fetch-site') === 'same-origin';
  if (!(allowMissingForSameOrigin && sameOrigin)) throw new AppError(403, 'CSRF_INVALID', 'Origin header required.');
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @RateLimit(10, 60)
  async register(@Body() raw: unknown, @Res({ passthrough: true }) res: Response) {
    const b = body(raw, ['username', 'email', 'password']);
    const username = str(b.username, 'username', { min: 3, max: 24, pattern: USERNAME });
    const email = str(b.email, 'email', { min: 3, max: 255, pattern: EMAIL });
    const password = str(b.password, 'password', { min: 8, max: 72 });
    const { user, tokens } = await this.auth.register(username, email, password);
    return { user, ...this.deliver(res, tokens) };
  }

  @Post('login')
  @HttpCode(200)
  @RateLimit(10, 60)
  async login(@Body() raw: unknown, @Res({ passthrough: true }) res: Response) {
    const b = body(raw, ['email', 'password']);
    const email = str(b.email, 'email', { min: 3, max: 255 });
    const password = str(b.password, 'password', { min: 1, max: 72 });
    const { user, tokens } = await this.auth.login(email, password);
    return { user, ...this.deliver(res, tokens) };
  }

  @Post('refresh')
  @HttpCode(200)
  @RateLimit(30, 60)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    requireTrustedOrigin(req, false);
    const tokens = await this.auth.refresh(readCookie(req, config.refreshCookieName), headerValue(req, 'x-csrf-token'));
    return this.deliver(res, tokens);
  }

  @Post('logout')
  @HttpCode(200)
  @RateLimit(30, 60)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    requireTrustedOrigin(req, false);
    await this.auth.logout(readCookie(req, config.refreshCookieName), headerValue(req, 'x-csrf-token'));
    res.clearCookie(config.refreshCookieName, this.cookieOptions());
    return { success: true };
  }

  /** Returns a new CSRF token for the current refresh-cookie session. Grants no access token. */
  @Get('csrf')
  @RateLimit(30, 60)
  async csrf(@Req() req: Request) {
    requireTrustedOrigin(req, true);
    return { csrfToken: await this.auth.issueCsrfToken(readCookie(req, config.refreshCookieName)) };
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      secure: config.cookieSecure,
      sameSite: 'lax' as const,
      path: config.refreshCookiePath,
    };
  }

  /** Puts the refresh token in the HttpOnly cookie and returns the JSON-safe part. */
  private deliver(res: Response, tokens: SessionTokens) {
    res.cookie(config.refreshCookieName, tokens.refreshToken, {
      ...this.cookieOptions(),
      maxAge: config.refreshTokenTtlMs,
    });
    return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn, csrfToken: tokens.csrfToken };
  }
}
