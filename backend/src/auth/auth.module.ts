import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { SessionCleanupService } from './session-cleanup.service';

// Global so every module can use AuthGuard and AuthService.
@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, SessionCleanupService],
  exports: [AuthService, AuthGuard],
})
export class AuthModule {}
