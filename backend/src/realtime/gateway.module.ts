import { Module } from '@nestjs/common';
import { MatchesModule } from '../matches/matches.module';
import { RoomsModule } from '../rooms/rooms.module';
import { GameGateway } from './game.gateway';

@Module({
  imports: [RoomsModule, MatchesModule],
  providers: [GameGateway],
})
export class GatewayModule {}
