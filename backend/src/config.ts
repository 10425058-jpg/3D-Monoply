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
  // Render supplies its own HTTPS origin automatically at runtime. Custom
  // domains can be added with CORS_ORIGIN (comma-separated exact origins).
  corsOrigins: [...new Set([
    ...list(process.env.CORS_ORIGIN, process.env.RENDER_EXTERNAL_URL ? '' : 'http://localhost:5173'),
    ...(process.env.RENDER_EXTERNAL_URL ? [process.env.RENDER_EXTERNAL_URL] : []),
  ])],
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? '',
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  // Trust only the single Render edge proxy; direct local development trusts none.
  // Never use trust proxy=true: it accepts client-forged leftmost X-Forwarded-For entries.
  trustProxyHops: Number(process.env.TRUST_PROXY_HOPS ?? '0'),

  accessTokenTtlSeconds: 900, // 15 minutes
  refreshTokenTtlMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  refreshCookieName: 'refresh_token',
  refreshCookiePath: '/api/v1/auth',

  disconnectGraceMs: positiveInt(process.env.DISCONNECT_GRACE_SECONDS, 120) * 1000,
  allOfflineAbandonMs: 24 * 60 * 60 * 1000, // 24 hours
  lifecycleSweepMs: 5000,
};

export function assertConfig(): void {
  if (![0, 1].includes(config.trustProxyHops)) {
    throw new Error('TRUST_PROXY_HOPS must be 0 or 1. Confirm proxy topology before changing it.');
  }
  if (process.env.RENDER === 'true' && config.trustProxyHops !== 1) {
    throw new Error('Render requires TRUST_PROXY_HOPS=1 for correct per-client rate limits.');
  }
  if (config.jwtAccessSecret.length < 32) {
    throw new Error('JWT_ACCESS_SECRET is missing or too short (need 32+ characters). Copy .env.example to .env and set it.');
  }
}
