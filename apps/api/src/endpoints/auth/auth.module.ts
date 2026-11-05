import { Module } from "@nestjs/common"
import { RedisModule } from "@nestjs-redis/client"

import { UserSessionModule } from "@entities/userSession/userSession.module"
import { UserModule } from "@entities/user/user.module"
import { DatabaseModule } from "@infrastructure/database/database.module"
import { SecurityModule } from "@infrastructure/security/security.module"
import { InfrastructureConfigModule } from "@infrastructure/config/config.module"
import { InfrastructureConfigService } from "@infrastructure/config/services/configService"
import { LoggerModule } from "@infrastructure/logger/logger.module"
import { MailModule } from "@infrastructure/mail/mail.module"

import { AuthController } from "@endpoints/auth/controllers/authController"
import { SessionController } from "@endpoints/auth/controllers/sessionController"
import { PasswordResetController } from "@endpoints/auth/controllers/passwordResetController"
import { AuthService } from "@endpoints/auth/services/authService"
import { ConfirmationService } from "@endpoints/auth/services/confirmationService"
import { SessionService } from "@endpoints/auth/services/sessionService"
import { PasswordResetService } from "@endpoints/auth/services/passwordResetService"

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
