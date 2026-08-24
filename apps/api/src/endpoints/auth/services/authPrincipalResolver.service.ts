import { Injectable, UnauthorizedException } from "@nestjs/common"

import { UserRepository } from "@entities/user/services/user.repository"

import type { IAuthPrincipalResolver } from "@infrastructure/security/types/IAuthPrincipalResolver"
import type { TJwtPayload } from "@infrastructure/security/types/TJwtPayload"
import type { IAuthPrincipal } from "@infrastructure/security/types/IAuthPrincipal"

@Injectable()
class AuthPrincipalResolverService implements IAuthPrincipalResolver {
  constructor(private readonly userRepository: UserRepository) {}

  async resolve(payload: TJwtPayload): Promise<IAuthPrincipal> {
    const user = await this.userRepository.findById(payload.sub)

    if (!user || user.status !== "active") {
      throw new UnauthorizedException("User is not active")
    }

    return {
      id: user._id.toString(),
      sessionId: payload.sessionId,
      roles: [user.role],
    }
  }
}

export { AuthPrincipalResolverService }
