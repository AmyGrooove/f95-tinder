import { Injectable, UnauthorizedException } from "@nestjs/common"
import { isObjectIdOrHexString, Types } from "mongoose"

import { SessionRepository } from "@entities/session/services/session.repository"
import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { UserRepository } from "@entities/user/services/user.repository"
import { SecurityJwtService } from "@infrastructure/security/services/jwt.service"
import { isNil } from "@shared/functions/checks/isNil"
import { isString } from "@shared/functions/checks/isString"
import { requestContext } from "@shared/functions/requestContext"

import type { WhoamiResponseDto } from "../dto/response/whoami.response"

@Injectable()
class AccountService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly jwtService: SecurityJwtService,
  ) {}

  async whoami(accessToken: unknown): Promise<WhoamiResponseDto> {
    if (!isString(accessToken) || accessToken.length === 0) {
      throw new UnauthorizedException(DICTIONARY.auth.unauthorized)
    }

    const payload = await this.jwtService.verifyAccessToken(accessToken)

    if (
      !isObjectIdOrHexString(payload.sub) ||
      !isObjectIdOrHexString(payload.sessionId)
    ) {
      throw new UnauthorizedException(DICTIONARY.auth.unauthorized)
    }

    const [session, user] = await Promise.all([
      this.sessionRepository.read.findOne(
        {
          _id: new Types.ObjectId(payload.sessionId),
          user: new Types.ObjectId(payload.sub),
          expiresAt: { $gt: new Date() },
        },
        { _id: 1, expiresAt: 1 },
      ),
      this.userRepository.read.findById(payload.sub, {
        _id: 1,
        username: 1,
        displayName: 1,
        avatarUrl: 1,
        role: 1,
      }),
    ])

    if (isNil(session) || isNil(user)) {
      throw new UnauthorizedException(DICTIONARY.auth.unauthorized)
    }

    requestContext.set("userId", user._id.toHexString())

    return {
      user: {
        id: user._id.toHexString(),
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        role: user.role,
      },
      session: {
        id: session._id.toHexString(),
        expiresAt: session.expiresAt.toISOString(),
      },
    }
  }
}

export { AccountService }
