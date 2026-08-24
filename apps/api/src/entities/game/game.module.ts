import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"

import { DatabaseModule } from "@infrastructure/database/database.module"

import { Game, GameSchema } from "./schemas/game.schema"
import { GameRepository } from "./services/game.repository"

@Module({
  imports: [
    DatabaseModule,
    MongooseModule.forFeature([{ name: Game.name, schema: GameSchema }]),
  ],
  providers: [GameRepository],
  exports: [GameRepository],
})
class GameModule {}

export { GameModule }
