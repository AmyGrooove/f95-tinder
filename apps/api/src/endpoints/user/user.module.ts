import { Module } from "@nestjs/common"

import { AuthModule } from "@endpoints/auth/auth.module"
import { UserModule } from "@entities/user/user.module"
import { UserItemModule } from "@entities/userItem/userItem.module"
import { CacheModule } from "@infrastructure/cache/cache.module"

import { UserReadController } from "./controllers/userReadController"
import { UserLibraryService } from "./services/userLibraryService"

@Module({
  imports: [AuthModule, UserModule, UserItemModule, CacheModule],
  controllers: [UserReadController],
  providers: [UserLibraryService],
})
class UserEndpointModule {}

export { UserEndpointModule }
