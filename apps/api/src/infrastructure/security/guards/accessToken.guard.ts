import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common"
import { SecurityJwtService } from "../services/jwt.service"
import type { ICurrentUserRequest } from "../types/ICurrentUserRequest"
import { DICTIONARY } from "@shared/static/DICTIONARY"
import { isNil } from "@shared/functions/checks/isNil"

@Injectable()
class AccessTokenGuard implements CanActivate {
  constructor(private readonly securityJwtService: SecurityJwtService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<
      {
        headers: { authorization?: string }
      } & ICurrentUserRequest
    >()
    const authorizationHeader = request.headers.authorization

    if (
      isNil(authorizationHeader) ||
      !/^Bearer [^\s]+$/i.test(authorizationHeader)
    ) {
      throw new UnauthorizedException(DICTIONARY.security.accessTokenRequired)
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
