import { Module } from "@nestjs/common"
import { JwtModule } from "@nestjs/jwt"

import { InfrastructureConfigModule } from "@infrastructure/config/config.module"

import { AccessTokenGuard } from "./services/accessTokenGuard"
import { RolesGuard } from "./services/rolesGuard"
import { SecurityJwtService } from "@infrastructure/security/services/jwtService"
import { SecurityCookieService } from "@infrastructure/security/services/cookieService"

@Module({
  imports: [InfrastructureConfigModule, JwtModule.register({})],
  providers: [
    SecurityJwtService,
    SecurityCookieService,
    AccessTokenGuard,
    RolesGuard,
  ],
  exports: [
    SecurityJwtService,
    SecurityCookieService,
    AccessTokenGuard,
    RolesGuard,
  ],
})
class SecurityModule {}

export { SecurityModule }
