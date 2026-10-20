import { Module } from "@nestjs/common"

import { SessionModule } from "@entities/session/session.module"
import { UserModule } from "@entities/user/user.module"
import { SecurityModule } from "@infrastructure/security/security.module"

import { AccountController } from "./controllers/account.controller"
import { AccountService } from "./services/account.service"

@Module({
  imports: [UserModule, SessionModule, SecurityModule],
  controllers: [AccountController],
  providers: [AccountService],
})
class AccountModule {}

export { AccountModule }
