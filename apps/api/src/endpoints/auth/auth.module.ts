import { Module } from "@nestjs/common"

import { SessionModule } from "@entities/session/session.module"
import { UserModule } from "@entities/user/user.module"
import { DatabaseModule } from "@infrastructure/database/database.module"
import { SecurityModule } from "@infrastructure/security/security.module"

import { AuthController } from "./controllers/auth.controller"
import { AuthService } from "./services/auth.service"

@Module({
  imports: [UserModule, SessionModule, DatabaseModule, SecurityModule],
  controllers: [AuthController],
  providers: [AuthService],
})
class AuthModule {}

export { AuthModule }
