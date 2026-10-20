import { createHash } from "node:crypto"

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
import { JWT_REFRESH_EXPIRATION } from "@infrastructure/security/static/JWT_REFRESH_EXPIRATION"
import { isNil } from "@shared/functions/checks/isNil"
import { isString } from "@shared/functions/checks/isString"
import { requestContext } from "@shared/functions/requestContext"

import type { SessionResponseDto } from "../dto/response/session.response"

@Injectable()
class SessionService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly jwtService: SecurityJwtService,
  ) {}

  async getSessions(accessToken: unknown): Promise<SessionResponseDto[]> {
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

    const [sessions, hasUser] = await Promise.all([
      this.sessionRepository.read.findMany(
        {
          user: new Types.ObjectId(payload.sub),
          expiresAt: { $gt: new Date() },
        },
        {
          _id: 1,
          userAgent: 1,
          createdAt: 1,
          expiresAt: 1,
          lastRefreshedAt: 1,
        },
        { sort: { createdAt: -1, _id: -1 } },
      ),
      this.userRepository.read.checkIsExists({
        _id: new Types.ObjectId(payload.sub),
      }),
    ])

    const hasCurrentSession = sessions.some((session) => {
      return session._id.equals(payload.sessionId)
    })

    if (!hasUser || !hasCurrentSession) {
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

    const userId = new Types.ObjectId(payload.sub)
    const [hasUser, hasCurrentSession] = await Promise.all([
      this.userRepository.read.checkIsExists({ _id: userId }),
      this.sessionRepository.read.checkIsExists({
        _id: new Types.ObjectId(payload.sessionId),
        user: userId,
        expiresAt: { $gt: new Date() },
      }),
    ])

    if (!hasUser || !hasCurrentSession) {
      throw new UnauthorizedException(DICTIONARY.auth.unauthorized)
    }

    requestContext.set("userId", payload.sub)

    const session = await this.sessionRepository.write.deleteByFilter({
      _id: sessionId,
      user: userId,
      expiresAt: { $gt: new Date() },
    })

    if (isNil(session)) {
      throw new NotFoundException(DICTIONARY.auth.sessionNotFound)
    }

    return sessionId.equals(payload.sessionId)
  }

  async deleteOtherSessions(accessToken: unknown): Promise<void> {
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

    const userId = new Types.ObjectId(payload.sub)
    const currentSessionId = new Types.ObjectId(payload.sessionId)
    const [hasUser, hasCurrentSession] = await Promise.all([
      this.userRepository.read.checkIsExists({ _id: userId }),
      this.sessionRepository.read.checkIsExists({
        _id: currentSessionId,
        user: userId,
        expiresAt: { $gt: new Date() },
      }),
    ])

    if (!hasUser || !hasCurrentSession) {
      throw new UnauthorizedException(DICTIONARY.auth.unauthorized)
    }

    requestContext.set("userId", payload.sub)

    await this.sessionRepository.bulk.deleteMany({
      user: userId,
      _id: { $ne: currentSessionId },
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
}

export { SessionService }
