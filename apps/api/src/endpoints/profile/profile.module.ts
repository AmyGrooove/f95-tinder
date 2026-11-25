import { Module } from "@nestjs/common"

import { AuthModule } from "@endpoints/auth/auth.module"
import { ItemModule } from "@entities/item/item.module"
import { UserModule } from "@entities/user/user.module"
import { UserActivityModule } from "@entities/userActivity/userActivity.module"
import { CacheModule } from "@infrastructure/cache/cache.module"
import { StorageModule } from "@infrastructure/storage/storage.module"

import { ProfileHistoryController } from "./controllers/profileHistoryController"
import { ProfileHistoryService } from "./services/profileHistoryService"

@Module({
  imports: [
    AuthModule,
    ItemModule,
    UserModule,
    UserActivityModule,
    CacheModule,
    StorageModule,
  ],
  controllers: [ProfileHistoryController],
  providers: [ProfileHistoryService],
})
class ProfileEndpointModule {}

export { ProfileEndpointModule }
