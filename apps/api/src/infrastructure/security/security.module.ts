import { Module } from "@nestjs/common"
import { JwtModule } from "@nestjs/jwt"

import { InfrastructureConfigModule } from "@infrastructure/config/config.module"

import { AccessTokenGuard } from "./guards/accessToken.guard"
import { RolesGuard } from "./guards/roles.guard"
import { SecurityJwtService } from "./services/jwt.service"

@Module({
  imports: [InfrastructureConfigModule, JwtModule.register({})],
  providers: [SecurityJwtService, AccessTokenGuard, RolesGuard],
  exports: [SecurityJwtService, AccessTokenGuard, RolesGuard],
})
class SecurityModule {}

export { SecurityModule }
