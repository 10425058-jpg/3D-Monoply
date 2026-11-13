import { Module } from '@nestjs/common';
import { LifecycleService } from './lifecycle.service';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';

@Module({
  controllers: [MatchesController],
  providers: [MatchesService, LifecycleService],
  exports: [MatchesService, LifecycleService],
})
export class MatchesModule {}
