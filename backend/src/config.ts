// Central place for every setting. Values come from environment variables (see .env.example).

function list(value: string | undefined, fallback: string): string[] {
  return (value ?? fallback)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function positiveInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

export const config = {
  port: positiveInt(process.env.PORT, 3000),
  corsOrigins: list(process.env.CORS_ORIGIN, 'http://localhost:5173'),
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? '',
  cookieSecure: process.env.COOKIE_SECURE === 'true',

  accessTokenTtlSeconds: 900, // 15 minutes
  refreshTokenTtlMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  refreshCookieName: 'refresh_token',
  refreshCookiePath: '/api/v1/auth',

  disconnectGraceMs: positiveInt(process.env.DISCONNECT_GRACE_SECONDS, 120) * 1000,
  allOfflineAbandonMs: 24 * 60 * 60 * 1000, // 24 hours
  lifecycleSweepMs: 5000,
};

export function assertConfig(): void {
  if (config.jwtAccessSecret.length < 32) {
    throw new Error('JWT_ACCESS_SECRET is missing or too short (need 32+ characters). Copy .env.example to .env and set it.');
  }
}
