import { Injectable, ServiceUnavailableException } from "@nestjs/common"
import { mongo, Types } from "mongoose"

import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { SessionRepository } from "@entities/session/services/session.repository"
import { UserRepository } from "@entities/user/services/user.repository"
import { MongoTransactionService } from "@infrastructure/database/services/mongoTransaction.service"
import { SecurityJwtService } from "@infrastructure/security/services/jwt.service"
import { requestContext } from "@shared/functions/requestContext"

@Injectable()
class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly transactionService: MongoTransactionService,
    private readonly jwtService: SecurityJwtService,
  ) {}

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
