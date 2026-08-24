import { Module } from "@nestjs/common"
import { JwtModule } from "@nestjs/jwt"

import { InfrastructureConfigModule } from "@infrastructure/config/config.module"

import { AccessTokenGuard } from "./guards/accessToken.guard"
import { RoleGuard } from "./guards/role.guard"
import { SecurityJwtService } from "./services/jwt.service"

@Module({
  imports: [InfrastructureConfigModule, JwtModule.register({})],
  providers: [SecurityJwtService, AccessTokenGuard, RoleGuard],
  exports: [SecurityJwtService, AccessTokenGuard, RoleGuard],
})
class SecurityModule {}

export { SecurityModule }
