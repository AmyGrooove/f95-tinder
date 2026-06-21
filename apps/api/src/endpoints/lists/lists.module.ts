import { Module } from '@nestjs/common';

import { GameModule } from '../../entities/game/game.module';
import { UserGameStateModule } from '../../entities/userGameState/userGameState.module';
import { SecurityModule } from '../../infrastructure/security/security.module';
import { ListsController } from './controllers/lists.controller';
import { ListsService } from './services/lists.service';

@Module({
  imports: [
    GameModule,
    UserGameStateModule,
    SecurityModule,
  ],
  controllers: [ListsController],
  providers: [ListsService],
})
export class ListsModule {}
