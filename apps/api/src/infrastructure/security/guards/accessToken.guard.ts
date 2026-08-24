import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common"
import { ModuleRef } from "@nestjs/core"

import { AUTH_PRINCIPAL_RESOLVER } from "../static/AUTH_PRINCIPAL_RESOLVER"
import { SecurityJwtService } from "../services/jwt.service"
import type { IAuthPrincipalResolver } from "../types/IAuthPrincipalResolver"
import type { ICurrentUserRequest } from "@infrastructure/security/decorators/CurrentUser/types/ICurrentUserRequest"

@Injectable()
class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly securityJwtService: SecurityJwtService,
    private readonly moduleRef: ModuleRef,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string }
    } & ICurrentUserRequest>()
    const authorizationHeader = request.headers.authorization

    if (!authorizationHeader || !/^Bearer [^\s]+$/.test(authorizationHeader)) {
      throw new UnauthorizedException("Access token is required")
    }

    const accessToken = authorizationHeader.slice("Bearer ".length)
    const payload = await this.securityJwtService.verifyAccessToken(accessToken)
    const authPrincipalResolver = this.moduleRef.get<IAuthPrincipalResolver>(
      AUTH_PRINCIPAL_RESOLVER,
      { strict: false },
    )

    request.authPrincipal = await authPrincipalResolver.resolve(payload)

    return true
  }
}

export { AccessTokenGuard }
