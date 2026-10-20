import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common"
import { isObjectIdOrHexString, Types } from "mongoose"

import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { SessionRepository } from "@entities/session/services/session.repository"
import { UserRepository } from "@entities/user/services/user.repository"
import { SecurityJwtService } from "@infrastructure/security/services/jwt.service"
import { isNil } from "@shared/functions/checks/isNil"
import { isString } from "@shared/functions/checks/isString"
import { requestContext } from "@shared/functions/requestContext"

import { AuthService } from "./auth.service"

import type { SessionResponseDto } from "../dto/response/session.response"

@Injectable()
class SessionService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly jwtService: SecurityJwtService,
    private readonly authService: AuthService,
  ) {}

  async getSessions(accessToken: unknown): Promise<SessionResponseDto[]> {
    const payload = await this.authService.verifyAccessToken(accessToken)

    const [sessions, isUserPresent] = await Promise.all([
      this.sessionRepository.findActiveByUser(new Types.ObjectId(payload.sub)),
      this.userRepository.read.checkIsExists({
        _id: new Types.ObjectId(payload.sub),
      }),
    ])

    const isCurrentSessionPresent = sessions.some((session) => {
      return session._id.equals(payload.sessionId)
    })

    if (!isUserPresent || !isCurrentSessionPresent) {
      throw new UnauthorizedException(DICTIONARY.auth.unauthorized)
    }

    requestContext.set("userId", payload.sub)

    return sessions.map((session) => {
      return {
        id: session._id.toHexString(),
        userAgent: session.userAgent,
        createdAt: session.createdAt.toISOString(),
        expiresAt: session.expiresAt.toISOString(),
        lastRefreshedAt: session.lastRefreshedAt?.toISOString() ?? null,
        isCurrent: session._id.equals(payload.sessionId),
      }
    })
  }

  async deleteSession(accessToken: unknown, sessionId: Types.ObjectId) {
    const payload = await this.authService.verifyAccessToken(accessToken)

    const userId = new Types.ObjectId(payload.sub)
    const [isUserPresent, currentSession] = await Promise.all([
      this.userRepository.read.checkIsExists({ _id: userId }),
      this.sessionRepository.findActive({
        id: new Types.ObjectId(payload.sessionId),
        userId,
      }),
    ])

    if (!isUserPresent || isNil(currentSession)) {
      throw new UnauthorizedException(DICTIONARY.auth.unauthorized)
    }

    requestContext.set("userId", payload.sub)

    const session = await this.sessionRepository.deleteActive({
      id: sessionId,
      userId,
    })

    if (isNil(session)) {
      throw new NotFoundException(DICTIONARY.auth.sessionNotFound)
    }

    return sessionId.equals(payload.sessionId)
  }

  async deleteOtherSessions(accessToken: unknown) {
    const payload = await this.authService.verifyAccessToken(accessToken)

    const userId = new Types.ObjectId(payload.sub)
    const currentSessionId = new Types.ObjectId(payload.sessionId)
    const [isUserPresent, currentSession] = await Promise.all([
      this.userRepository.read.checkIsExists({ _id: userId }),
      this.sessionRepository.findActive({
        id: currentSessionId,
        userId,
      }),
    ])

    if (!isUserPresent || isNil(currentSession)) {
      throw new UnauthorizedException(DICTIONARY.auth.unauthorized)
    }

    requestContext.set("userId", payload.sub)

    await this.sessionRepository.deleteOthers({
      userId,
      id: currentSessionId,
    })
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

    const { accessToken, refreshToken: newRefreshToken } =
      await this.authService.issueTokens({
        sub: user._id.toHexString(),
        sessionId: payload.sessionId,
        role: user.role,
      })
    const session = await this.sessionRepository.updateRefreshToken({
      id: new Types.ObjectId(payload.sessionId),
      userId: user._id,
      currentRefreshToken: refreshToken,
      refreshToken: newRefreshToken,
    })

    if (isNil(session)) {
      throw new UnauthorizedException(DICTIONARY.auth.unauthorized)
    }

    requestContext.set("userId", user._id.toHexString())

    return { accessToken, refreshToken: newRefreshToken }
  }
}

export { SessionService }
