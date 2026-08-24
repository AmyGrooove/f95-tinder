import { Module } from "@nestjs/common"

import { CreatorModule } from "@entities/creator/creator.module"
import { PrefixModule } from "@entities/prefix/prefix.module"
import { TagModule } from "@entities/tag/tag.module"
import { UserGameStateModule } from "@entities/userGameState/userGameState.module"
import { SecurityModule } from "@infrastructure/security/security.module"
import { AuthModule } from "../auth/auth.module"
import { AuthPrincipalModule } from "../auth/authPrincipal.module"
import { SyncModule } from "../sync/sync.module"

import { BootstrapController } from "./controllers/bootstrap.controller"
import { BootstrapService } from "./services/bootstrap.service"

@Module({
  imports: [
    CreatorModule,
    SecurityModule,
    AuthModule,
    AuthPrincipalModule,
    PrefixModule,
    TagModule,
    UserGameStateModule,
    SyncModule,
  ],
  controllers: [BootstrapController],
  providers: [BootstrapService],
})
class BootstrapModule {}

export { BootstrapModule }
