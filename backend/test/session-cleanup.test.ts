import test from 'node:test';
import assert from 'node:assert/strict';
import { SessionCleanupService } from '../src/auth/session-cleanup.service';
import type { PrismaService } from '../src/prisma/prisma.service';

test('cleanup uses bounded batches and prunes only expired or long-revoked sessions', async () => {
  const seen: Array<{ op: string; arg: any }> = [];
  const db = {
    userSession: {
      findMany: async (arg: any) => {
        seen.push({ op: 'find', arg });
        return [{ id: 'expired-session' }, { id: 'old-revoked-session' }];
      },
      deleteMany: async (arg: any) => {
        seen.push({ op: 'delete', arg });
        return { count: 2 };
      },
    },
  } as unknown as PrismaService;
  const cleanup = new SessionCleanupService(db);
  const now = new Date('2026-11-13T00:00:00.000Z');
  assert.equal(await cleanup.cleanupOnce(now), 2);
  assert.equal(seen[0].arg.take, 1000);
  assert.deepEqual(seen[0].arg.select, { id: true });
  assert.deepEqual(seen[0].arg.where.OR[0], { expiresAt: { lt: now } });
  assert.equal(seen[0].arg.where.OR[1].revokedAt.lt.toISOString(), '2026-11-06T00:00:00.000Z');
  assert.deepEqual(seen[1].arg.where.id.in, ['expired-session', 'old-revoked-session']);
  assert.deepEqual(seen[1].arg.where.OR, seen[0].arg.where.OR);
});

test('empty cleanup is a no-op and errors are contained so startup stays healthy', async () => {
  let deleted = false;
  const empty = new SessionCleanupService({
    userSession: {
      findMany: async () => [],
      deleteMany: async () => { deleted = true; return { count: 1 }; },
    },
  } as unknown as PrismaService);
  assert.equal(await empty.cleanupOnce(), 0);
  assert.equal(deleted, false);
  const broken = new SessionCleanupService({
    userSession: { findMany: async () => { throw new Error('database disconnected'); } },
  } as unknown as PrismaService);
  assert.equal(await broken.cleanupOnce(), 0);
});
