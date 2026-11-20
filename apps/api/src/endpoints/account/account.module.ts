import { Module } from "@nestjs/common"
import { RedisModule } from "@nestjs-redis/client"

import { AuthModule } from "@endpoints/auth/auth.module"
import { ItemModule } from "@entities/item/item.module"
import { UserItemModule } from "@entities/userItem/userItem.module"
import { UserItemHistoryModule } from "@entities/userItemHistory/userItemHistory.module"
import { UserSessionModule } from "@entities/userSession/userSession.module"
import { UserModule } from "@entities/user/user.module"
import { CacheModule } from "@infrastructure/cache/cache.module"
import { SecurityModule } from "@infrastructure/security/security.module"
import { InfrastructureConfigModule } from "@infrastructure/config/config.module"
import { InfrastructureConfigService } from "@infrastructure/config/services/configService"
import { MailModule } from "@infrastructure/mail/mail.module"
import { LoggerModule } from "@infrastructure/logger/logger.module"
import { DatabaseModule } from "@infrastructure/database/database.module"
import { StorageModule } from "@infrastructure/storage/storage.module"

import { AccountController } from "@endpoints/account/controllers/accountController"
import { AccountAvatarController } from "@endpoints/account/controllers/accountAvatarController"
import { AccountSetupController } from "@endpoints/account/controllers/accountSetupController"
import { AccountEmailController } from "@endpoints/account/controllers/accountEmailController"
import { AccountCredentialsController } from "@endpoints/account/controllers/accountCredentialsController"
import { LibraryHistoryController } from "@endpoints/account/controllers/libraryHistoryController"
import { AccountService } from "@endpoints/account/services/accountService"
import { AccountAvatarService } from "@endpoints/account/services/accountAvatarService"
import { AccountSetupService } from "@endpoints/account/services/accountSetupService"
import { AccountEmailService } from "@endpoints/account/services/accountEmailService"
import { LibraryHistoryService } from "@endpoints/account/services/libraryHistoryService"

@Module({
  imports: [
    AuthModule,
    ItemModule,
    UserItemModule,
    UserItemHistoryModule,
    UserModule,
    UserSessionModule,
    SecurityModule,
    CacheModule,
    MailModule,
    LoggerModule,
    InfrastructureConfigModule,
    DatabaseModule,
    StorageModule,
    RedisModule.forRootAsync({
      connectionName: "account",
      imports: [InfrastructureConfigModule],
      inject: [InfrastructureConfigService],
      useFactory: (configService: InfrastructureConfigService) => {
        return { options: { url: configService.redis.url } }
      },
    }),
  ],
  controllers: [
    AccountController,
    AccountAvatarController,
    AccountSetupController,
    AccountEmailController,
    AccountCredentialsController,
    LibraryHistoryController,
  ],
  providers: [
    AccountService,
    AccountAvatarService,
    AccountSetupService,
    AccountEmailService,
    LibraryHistoryService,
  ],
})
class AccountModule {}

export { AccountModule }
