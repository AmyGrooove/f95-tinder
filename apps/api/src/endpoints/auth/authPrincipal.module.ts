import { Module } from "@nestjs/common"

import { UserModule } from "@entities/user/user.module"
import { AUTH_PRINCIPAL_RESOLVER } from "@infrastructure/security/static/AUTH_PRINCIPAL_RESOLVER"

import { AuthPrincipalResolverService } from "./services/authPrincipalResolver.service"

@Module({
  imports: [UserModule],
  providers: [
    AuthPrincipalResolverService,
    {
      provide: AUTH_PRINCIPAL_RESOLVER,
      useExisting: AuthPrincipalResolverService,
    },
  ],
  exports: [AUTH_PRINCIPAL_RESOLVER],
})
class AuthPrincipalModule {}

export { AuthPrincipalModule }
