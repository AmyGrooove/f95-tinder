import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Game, GameSchema } from './schemas/game.schema';
import { GameRepository } from './services/game.repository';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Game.name, schema: GameSchema }]),
  ],
  providers: [GameRepository],
  exports: [GameRepository],
})
export class GameModule {}
