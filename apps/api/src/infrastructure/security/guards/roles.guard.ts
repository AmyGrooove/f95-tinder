import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common"
import { Reflector } from "@nestjs/core"

import { ROLES_METADATA_KEY } from "../decorators/Roles"
import { isNil } from "@shared/functions/checks/isNil"

import type { ICurrentUserRequest } from "../types/ICurrentUserRequest"
import { DICTIONARY } from "@shared/static/DICTIONARY"

@Injectable()
class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<readonly string[]>(
      ROLES_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    )

    if (isNil(roles) || roles.length === 0) {
      return true
    }

    const request = context.switchToHttp().getRequest<ICurrentUserRequest>()
    const authPrincipal = request.authPrincipal

    if (isNil(authPrincipal)) {
      throw new UnauthorizedException(DICTIONARY.security.userNotAuthenticated)
    }

    const isRoleAllowed = roles.includes(authPrincipal.role)

    if (!isRoleAllowed) {
      throw new ForbiddenException(DICTIONARY.security.roleNotAllowed)
    }

    return true
  }
}

export { RolesGuard }
