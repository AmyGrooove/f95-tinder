import { Module } from "@nestjs/common"

import { CreatorModule } from "@entities/creator/creator.module"
import { GameModule } from "@entities/game/game.module"
import { UserGameStateModule } from "@entities/userGameState/userGameState.module"
import { SecurityModule } from "@infrastructure/security/security.module"

import { AuthPrincipalModule } from "../auth/authPrincipal.module"
import { SwipeController } from "./controllers/swipe.controller"
import { SwipeService } from "./services/swipe.service"

@Module({
  imports: [
    AuthPrincipalModule,
    CreatorModule,
    GameModule,
    SecurityModule,
    UserGameStateModule,
  ],
  controllers: [SwipeController],
  providers: [SwipeService],
})
class SwipeModule {}

export { SwipeModule }
