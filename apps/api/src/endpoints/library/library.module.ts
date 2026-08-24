import { Module } from "@nestjs/common"

import { GameModule } from "@entities/game/game.module"
import { UserGameStateModule } from "@entities/userGameState/userGameState.module"
import { SecurityModule } from "@infrastructure/security/security.module"

import { AuthPrincipalModule } from "../auth/authPrincipal.module"
import { LibraryController } from "./controllers/library.controller"
import { LibraryService } from "./services/library.service"

@Module({
  imports: [AuthPrincipalModule, GameModule, SecurityModule, UserGameStateModule],
  controllers: [LibraryController],
  providers: [LibraryService],
  exports: [LibraryService],
})
class LibraryModule {}

export { LibraryModule }
