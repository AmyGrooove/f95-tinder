import { Module } from "@nestjs/common"
import { RedisModule } from "@nestjs-redis/client"

import { AuthModule } from "@endpoints/auth/auth.module"
import { UserSessionModule } from "@entities/userSession/userSession.module"
import { UserModule } from "@entities/user/user.module"
import { SecurityModule } from "@infrastructure/security/security.module"
import { InfrastructureConfigModule } from "@infrastructure/config/config.module"
import { InfrastructureConfigService } from "@infrastructure/config/services/configService"
import { MailModule } from "@infrastructure/mail/mail.module"
import { LoggerModule } from "@infrastructure/logger/logger.module"
import { DatabaseModule } from "@infrastructure/database/database.module"

import { AccountController } from "@endpoints/account/controllers/accountController"
import { AccountSetupController } from "@endpoints/account/controllers/accountSetupController"
import { AccountEmailController } from "@endpoints/account/controllers/accountEmailController"
import { AccountCredentialsController } from "@endpoints/account/controllers/accountCredentialsController"
import { AccountService } from "@endpoints/account/services/accountService"
import { AccountSetupService } from "@endpoints/account/services/accountSetupService"
import { AccountEmailService } from "@endpoints/account/services/accountEmailService"

@Module({
  imports: [
    AuthModule,
    UserModule,
    UserSessionModule,
    SecurityModule,
    MailModule,
    LoggerModule,
    InfrastructureConfigModule,
    DatabaseModule,
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
    AccountSetupController,
    AccountEmailController,
    AccountCredentialsController,
  ],
  providers: [AccountService, AccountSetupService, AccountEmailService],
})
class AccountModule {}

export { AccountModule }
