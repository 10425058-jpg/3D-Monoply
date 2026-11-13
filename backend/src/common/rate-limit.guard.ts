import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppError } from './errors';

const RATE_LIMIT_KEY = 'rateLimit';

interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

/** Allow at most `limit` calls per `windowSeconds` from one IP address for this route. */
export const RateLimit = (limit: number, windowSeconds: number) =>
  SetMetadata(RATE_LIMIT_KEY, { limit, windowMs: windowSeconds * 1000 });

/**
 * Small in-memory rate limiter (fixed window, per IP and route).
 * Good enough for one server process. With several server instances, replace it with a
 * shared store such as Redis.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();
  private lastCleanup = 0;

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.get(RATE_LIMIT_KEY, context.getHandler()) as RateLimitOptions | undefined;
    if (!options || context.getType() !== 'http') return true;

    const req = context.switchToHttp().getRequest();
    const now = Date.now();
    const key = `${context.getClass().name}.${context.getHandler().name}:${req.ip ?? 'unknown'}`;
    const entry = this.hits.get(key);

    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + options.windowMs });
    } else {
      entry.count += 1;
      if (entry.count > options.limit) {
        throw new AppError(429, 'RATE_LIMITED', 'Too many requests. Try again in a moment.', {
          retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000),
        });
      }
    }

    if (now - this.lastCleanup > 60000) {
      this.lastCleanup = now;
      for (const [k, v] of this.hits) if (v.resetAt <= now) this.hits.delete(k);
    }
    return true;
  }
}
