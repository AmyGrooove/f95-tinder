import { Module } from "@nestjs/common"

import { SessionModule } from "@entities/session/session.module"
import { UserModule } from "@entities/user/user.module"
import { SecurityModule } from "@infrastructure/security/security.module"

import { AuthPrincipalModule } from "./authPrincipal.module"
import { AuthController } from "./controllers/auth.controller"
import { AuthService } from "./services/auth.service"

@Module({
  imports: [AuthPrincipalModule, SecurityModule, UserModule, SessionModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
class AuthModule {}

export { AuthModule }
