import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common"
import { SecurityJwtService } from "../services/jwt.service"
import type { ICurrentUserRequest } from "@infrastructure/security/types/ICurrentUserRequest"

@Injectable()
class AccessTokenGuard implements CanActivate {
  constructor(private readonly securityJwtService: SecurityJwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<
      {
        headers: { authorization?: string }
      } & ICurrentUserRequest
    >()
    const authorizationHeader = request.headers.authorization

    if (
      authorizationHeader === undefined ||
      !/^Bearer [^\s]+$/i.test(authorizationHeader)
    ) {
      throw new UnauthorizedException("Access token is required")
    }

    const accessToken = authorizationHeader.slice("Bearer ".length)
    const payload = await this.securityJwtService.verifyAccessToken(accessToken)

    request.authPrincipal = {
      id: payload.sub,
      sessionId: payload.sessionId,
      role: payload.role,
    }

    return true
  }
}

export { AccessTokenGuard }
