import { Module } from "@nestjs/common"
import { RedisModule } from "@nestjs-redis/client"

import { AuthModule } from "@endpoints/auth/auth.module"
import { UserSessionModule } from "@entities/userSession/userSession.module"
import { UserModule } from "@entities/user/user.module"
import { SecurityModule } from "@infrastructure/security/security.module"
import { InfrastructureConfigModule } from "@infrastructure/config/config.module"
import { InfrastructureConfigService } from "@infrastructure/config/services/config.service"
import { MailModule } from "@infrastructure/mail/mail.module"
import { LoggerModule } from "@infrastructure/logger/logger.module"
import { DatabaseModule } from "@infrastructure/database/database.module"

import { AccountController } from "./controllers/account.controller"
import { AccountSetupController } from "./controllers/accountSetup.controller"
import { AccountEmailController } from "./controllers/accountEmail.controller"
import { AccountCredentialsController } from "./controllers/accountCredentials.controller"
import { AccountService } from "./services/account.service"
import { AccountSetupService } from "./services/accountSetup.service"
import { AccountEmailService } from "./services/accountEmail.service"

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
