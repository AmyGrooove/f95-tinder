import { Module } from "@nestjs/common"

import { SessionModule } from "@entities/session/session.module"
import { UserModule } from "@entities/user/user.module"
import { DatabaseModule } from "@infrastructure/database/database.module"
import { SecurityModule } from "@infrastructure/security/security.module"

import { AuthController } from "./controllers/auth.controller"
import { SessionController } from "./controllers/session.controller"
import { AuthService } from "./services/auth.service"
import { SessionService } from "./services/session.service"

@Module({
  imports: [UserModule, SessionModule, DatabaseModule, SecurityModule],
  controllers: [AuthController, SessionController],
  providers: [AuthService, SessionService],
})
class AuthModule {}

export { AuthModule }
