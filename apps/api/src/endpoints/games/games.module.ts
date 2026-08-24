import { Module } from "@nestjs/common"

import { CreatorModule } from "@entities/creator/creator.module"
import { GameModule } from "@entities/game/game.module"
import { PrefixModule } from "@entities/prefix/prefix.module"
import { TagModule } from "@entities/tag/tag.module"

import { GamesController } from "./controllers/games.controller"
import { GamesService } from "./services/games.service"

@Module({
  imports: [CreatorModule, GameModule, PrefixModule, TagModule],
  controllers: [GamesController],
  providers: [GamesService],
  exports: [GamesService],
})
class GamesModule {}

export { GamesModule }
