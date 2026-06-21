import { Module } from '@nestjs/common';

import { GameModule } from '../../entities/game/game.module';
import { SyncStateModule } from '../../entities/syncState/syncState.module';
import { UserGameStateModule } from '../../entities/userGameState/userGameState.module';
import { SecurityModule } from '../../infrastructure/security/security.module';
import { SwipeController } from './controllers/swipe.controller';
import { SwipeDecisionService } from './services/swipeDecision.service';
import { SwipeQueueService } from './services/swipeQueue.service';

@Module({
  imports: [
    GameModule,
    SyncStateModule,
    UserGameStateModule,
    SecurityModule,
  ],
  controllers: [SwipeController],
  providers: [SwipeQueueService, SwipeDecisionService],
})
export class SwipeModule {}
