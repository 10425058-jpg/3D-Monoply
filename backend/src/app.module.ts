import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { RateLimitGuard } from './common/rate-limit.guard';
import { HealthModule } from './health/health.module';
import { MatchesModule } from './matches/matches.module';
import { PrismaModule } from './prisma/prisma.module';
import { GatewayModule } from './realtime/gateway.module';
import { RealtimeModule } from './realtime/realtime.module';
import { RoomsModule } from './rooms/rooms.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    PrismaModule,
    RealtimeModule,
    AuthModule,
    HealthModule,
    UsersModule,
    RoomsModule,
    MatchesModule,
    GatewayModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: RateLimitGuard }],
})
export class AppModule {}
