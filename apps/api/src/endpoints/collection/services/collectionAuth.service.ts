import { Injectable, UnauthorizedException } from "@nestjs/common"

import { AuthService } from "@endpoints/auth/services/auth.service"
import { UserRepository } from "@entities/user/services/user.repository"
import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { isNil } from "@shared/functions/checks/isNil"
import { requestContext } from "@shared/functions/context/requestContext"

@Injectable()
class CollectionAuthService {
  constructor(
    private readonly authService: AuthService,
    private readonly userRepository: UserRepository,
  ) {}

  async authenticate(accessToken: unknown) {
    const payload = await this.authService.verifyAccessToken(accessToken)
    const [session, user] = await Promise.all([
      this.authService.getSession(payload),
      this.userRepository.read.findById(payload.sub, { _id: 1 }),
    ])

    if (isNil(session) || isNil(user)) {
      throw new UnauthorizedException(DICTIONARY.auth.unauthorized)
    }

    requestContext.set("userId", payload.sub)

    return user._id
  }
}

export { CollectionAuthService }
