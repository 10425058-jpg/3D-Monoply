import { Controller, Get } from '@nestjs/common';
import { AppError } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /api/v1/health (public)
   * 200 { data: { status: "ok" }, meta: {} } when the server and database are reachable.
   * 503 DEPENDENCY_UNAVAILABLE when the database is down.
   */
  @Get()
  async check() {
    if (!(await this.prisma.isHealthy())) {
      throw new AppError(503, 'DEPENDENCY_UNAVAILABLE', 'The database is unavailable.');
    }
    return { status: 'ok' };
  }
}
