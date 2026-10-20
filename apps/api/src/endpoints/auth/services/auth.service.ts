import { createHash } from "node:crypto"

import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common"
import { isObjectIdOrHexString, mongo, Types } from "mongoose"

import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { SessionRepository } from "@entities/session/services/session.repository"
import { UserRepository } from "@entities/user/services/user.repository"
import { MongoTransactionService } from "@infrastructure/database/services/mongoTransaction.service"
import { SecurityJwtService } from "@infrastructure/security/services/jwt.service"
import { JWT_REFRESH_EXPIRATION } from "@infrastructure/security/static/JWT_REFRESH_EXPIRATION"
import { isNil } from "@shared/functions/checks/isNil"
import { isString } from "@shared/functions/checks/isString"
import { requestContext } from "@shared/functions/requestContext"

@Injectable()
class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly transactionService: MongoTransactionService,
    private readonly jwtService: SecurityJwtService,
  ) {}

  async logout(accessToken: unknown): Promise<void> {
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

    const session = await this.sessionRepository.write.deleteByFilter({
      _id: new Types.ObjectId(payload.sessionId),
      user: new Types.ObjectId(payload.sub),
      expiresAt: { $gt: new Date() },
    })

    if (isNil(session)) {
      throw new UnauthorizedException(DICTIONARY.auth.unauthorized)
    }

    requestContext.set("userId", payload.sub)
  }

  async refresh(refreshToken: unknown) {
    if (!isString(refreshToken) || refreshToken.length === 0) {
      throw new UnauthorizedException(DICTIONARY.auth.unauthorized)
    }

    const payload = await this.jwtService.verifyRefreshToken(refreshToken)

    if (
      !isObjectIdOrHexString(payload.sub) ||
      !isObjectIdOrHexString(payload.sessionId)
    ) {
      throw new UnauthorizedException(DICTIONARY.auth.unauthorized)
    }

    const user = await this.userRepository.read.findById(payload.sub, {
      _id: 1,
      role: 1,
    })

    if (isNil(user)) {
      throw new UnauthorizedException(DICTIONARY.auth.unauthorized)
    }

    const [accessToken, newRefreshToken] = await Promise.all([
      this.jwtService.signAccessToken({
        sub: user._id.toHexString(),
        sessionId: payload.sessionId,
        role: user.role,
      }),
      this.jwtService.signRefreshToken({
        sub: user._id.toHexString(),
        sessionId: payload.sessionId,
      }),
    ])
    const now = new Date()
    const session = await this.sessionRepository.write.updateByFilter(
      {
        _id: new Types.ObjectId(payload.sessionId),
        user: user._id,
        refreshTokenHash: createHash("sha256")
          .update(refreshToken)
          .digest("hex"),
        expiresAt: { $gt: now },
      },
      {
        $set: {
          refreshTokenHash: createHash("sha256")
            .update(newRefreshToken)
            .digest("hex"),
          expiresAt: new Date(now.getTime() + JWT_REFRESH_EXPIRATION * 1000),
          lastRefreshedAt: now,
        },
      },
    )

    if (isNil(session)) {
      throw new UnauthorizedException(DICTIONARY.auth.unauthorized)
    }

    requestContext.set("userId", user._id.toHexString())

    return { accessToken, refreshToken: newRefreshToken }
  }

  async register(userAgent: string | undefined) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        const { userId, ...registration } = await this.transactionService.run(
          async (session) => {
            const { user, accessCode } = await this.userRepository.createNew({
              session,
            })
            const sessionId = new Types.ObjectId()

            const [accessToken, refreshToken] = await Promise.all([
              this.jwtService.signAccessToken({
                sub: user._id.toHexString(),
                sessionId: sessionId.toHexString(),
                role: user.role,
              }),
              this.jwtService.signRefreshToken({
                sub: user._id.toHexString(),
                sessionId: sessionId.toHexString(),
              }),
            ])

            await this.sessionRepository.createNew(
              { id: sessionId, userId: user._id, refreshToken, userAgent },
              { session },
            )

            return {
              userId: user._id.toHexString(),
              username: user.username,
              accessCode,
              accessToken,
              refreshToken,
            }
          },
        )

        requestContext.set("userId", userId)

        return registration
      } catch (error) {
        if (
          error instanceof mongo.MongoServerError &&
          error.code === 11000 &&
          error.keyPattern?.username === 1
        ) {
          continue
        }

        throw error
      }
    }

    throw new ServiceUnavailableException(DICTIONARY.auth.usernameUnavailable)
  }
}

export { AuthService }
