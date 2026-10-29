import { Module } from "@nestjs/common"
import { RedisModule } from "@nestjs-redis/client"

import { UserSessionModule } from "@entities/userSession/userSession.module"
import { UserModule } from "@entities/user/user.module"
import { DatabaseModule } from "@infrastructure/database/database.module"
import { SecurityModule } from "@infrastructure/security/security.module"
import { InfrastructureConfigModule } from "@infrastructure/config/config.module"
import { InfrastructureConfigService } from "@infrastructure/config/services/config.service"
import { LoggerModule } from "@infrastructure/logger/logger.module"
import { MailModule } from "@infrastructure/mail/mail.module"

import { AuthController } from "./controllers/auth.controller"
import { SessionController } from "./controllers/session.controller"
import { PasswordResetController } from "./controllers/passwordReset.controller"
import { AuthService } from "./services/auth.service"
import { ConfirmationService } from "./services/confirmation.service"
import { SessionService } from "./services/session.service"
import { PasswordResetService } from "./services/passwordReset.service"

@Module({
  imports: [
    UserModule,
    UserSessionModule,
    DatabaseModule,
    SecurityModule,
    InfrastructureConfigModule,
    LoggerModule,
    MailModule,
    RedisModule.forRootAsync({
      connectionName: "auth",
      imports: [InfrastructureConfigModule],
      inject: [InfrastructureConfigService],
      useFactory: (configService: InfrastructureConfigService) => {
        return { options: { url: configService.redis.url } }
      },
    }),
  ],
  controllers: [AuthController, SessionController, PasswordResetController],
  providers: [
    AuthService,
    SessionService,
    PasswordResetService,
    ConfirmationService,
  ],
  exports: [AuthService, ConfirmationService],
})
class AuthModule {}

export { AuthModule }
