import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Bounded maintenance: one server process, no external scheduler required.
 * A deleted refresh session is already invalid; old rotation references are
 * nullable and PostgreSQL ON DELETE SET NULL keeps referential integrity.
 */
const RETAIN_REVOKED_MS = 7 * 24 * 60 * 60 * 1000;
const SWEEP_MS = 60 * 60 * 1000;
const MAX_BATCH = 1000;

@Injectable()
export class SessionCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SessionCleanupService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    void this.cleanupOnce();
    this.timer = setInterval(() => void this.cleanupOnce(), SWEEP_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async cleanupOnce(now = new Date()): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      const olderThan = new Date(now.getTime() - RETAIN_REVOKED_MS);
      const candidates = await this.prisma.userSession.findMany({
        where: {
          OR: [
            { expiresAt: { lt: now } },
            { revokedAt: { lt: olderThan } },
          ],
        },
        select: { id: true },
        take: MAX_BATCH,
        orderBy: { createdAt: 'asc' },
      });
      if (!candidates.length) return 0;
      const result = await this.prisma.userSession.deleteMany({
        where: {
          id: { in: candidates.map(s => s.id) },
          OR: [
            { expiresAt: { lt: now } },
            { revokedAt: { lt: olderThan } },
          ],
        },
      });
      if (result.count) this.logger.log('Removed ' + result.count + ' expired or old revoked sessions');
      return result.count;
    } catch (error) {
      this.logger.error('Session cleanup failed: ' + (error instanceof Error ? error.message : String(error)));
      return 0;
    } finally {
      this.running = false;
    }
  }
}
