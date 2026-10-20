import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common"
import { Reflector } from "@nestjs/core"

import { ROLES_METADATA_KEY } from "@infrastructure/security/decorators/Roles/static/ROLES_METADATA_KEY"
import { isNil } from "@shared/functions/checks/isNil"

import type { ICurrentUserRequest } from "@infrastructure/security/types/ICurrentUserRequest"

@Injectable()
class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
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
      throw new UnauthorizedException("User is not authenticated")
    }

    const isRoleAllowed = roles.includes(authPrincipal.role)

    if (!isRoleAllowed) {
      throw new ForbiddenException("User role is not allowed")
    }

    return true
  }
}

export { RolesGuard }
