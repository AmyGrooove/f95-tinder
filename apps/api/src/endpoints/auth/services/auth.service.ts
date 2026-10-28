import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common"
import { isObjectIdOrHexString, mongo, Types } from "mongoose"

import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { SessionRepository } from "@entities/session/services/session.repository"
import { getCountryByIp } from "@entities/session/functions/getCountryByIp"
import { UserRepository } from "@entities/user/services/user.repository"
import { MongoTransactionService } from "@infrastructure/database/services/mongoTransaction.service"
import { SecurityJwtService } from "@infrastructure/security/services/jwt.service"
import { compareHash } from "@infrastructure/security/functions/compareHash"
import type { IAccessTokenPayload } from "@infrastructure/security/types/IAccessTokenPayload"
import type { IAuthTokens } from "@infrastructure/security/types/IAuthTokens"
import { isNil } from "@shared/functions/checks/isNil"
import { isString } from "@shared/functions/checks/isString"
import { requestContext } from "@shared/functions/context/requestContext"

import type { LoginCodeBodyDto } from "../dto/body/loginCode.body"
import type { LoginBodyDto } from "../dto/body/login.body"
import type { LoginCodeResponseDto } from "../dto/response/loginCode.response"
import type { RegisterResponseDto } from "../dto/response/register.response"
import type { ICreateAuthSessionProps } from "../types/ICreateAuthSessionProps"

@Injectable()
class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly transactionService: MongoTransactionService,
    private readonly jwtService: SecurityJwtService,
  ) {}

  async verifyAccessToken(accessToken: unknown) {
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

    return payload
  }

  getSession(payload: Pick<IAccessTokenPayload, "sub" | "sessionId">) {
    return this.sessionRepository.findActive({
      id: new Types.ObjectId(payload.sessionId),
      userId: new Types.ObjectId(payload.sub),
    })
  }

  async issueTokens(
    payload: Omit<IAccessTokenPayload, "type">,
  ): Promise<IAuthTokens> {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAccessToken(payload),
      this.jwtService.signRefreshToken({
        sub: payload.sub,
        sessionId: payload.sessionId,
      }),
    ])

    return { accessToken, refreshToken }
  }

  async login(body: LoginBodyDto, userAgent: string | undefined) {
    const user = await this.userRepository.read.findOne(
      { username: body.username },
      { _id: 1, role: 1, passwordHash: 1 },
    )

    if (isNil(user) || isNil(user.passwordHash)) {
      throw new UnauthorizedException(DICTIONARY.auth.invalidLoginCredentials)
    }

    const isPasswordValid = await compareHash(body.password, user.passwordHash)

    if (!isPasswordValid) {
      throw new UnauthorizedException(DICTIONARY.auth.invalidLoginCredentials)
    }

    const tokens = await this.createSession({
      userId: user._id,
      role: user.role,
      userAgent,
    })

    requestContext.set("userId", user._id.toHexString())

    return tokens
  }

  async loginByCode(body: LoginCodeBodyDto, userAgent: string | undefined) {
    const user = await this.userRepository.findByAccessCode(body.accessCode)

    if (isNil(user)) {
      throw new UnauthorizedException(DICTIONARY.auth.invalidCredentials)
    }

    const tokens = await this.createSession({
      userId: user._id,
      role: user.role,
      userAgent,
    })

    requestContext.set("userId", user._id.toHexString())

    return tokens
  }

  async logout(accessToken: unknown) {
    const payload = await this.verifyAccessToken(accessToken)

    const session = await this.sessionRepository.deleteActive({
      id: new Types.ObjectId(payload.sessionId),
      userId: new Types.ObjectId(payload.sub),
    })

    if (isNil(session)) {
      throw new UnauthorizedException(DICTIONARY.auth.unauthorized)
    }

    requestContext.set("userId", payload.sub)
  }

  async reissueCode(accessToken: unknown, body: LoginCodeBodyDto) {
    const payload = await this.verifyAccessToken(accessToken)

    const userId = new Types.ObjectId(payload.sub)
    const currentSessionId = new Types.ObjectId(payload.sessionId)
    const result = await this.transactionService.run(async (session) => {
      const { user, accessCode } = await this.userRepository.reissueAccessCode(
        { userId, accessCode: body.accessCode },
        { session },
      )

      if (isNil(user)) {
        throw new UnauthorizedException(DICTIONARY.auth.invalidCredentials)
      }

      const { accessToken: newAccessToken, refreshToken } =
        await this.issueTokens({
          sub: payload.sub,
          sessionId: payload.sessionId,
          role: user.role,
        })
      const currentSession = await this.sessionRepository.updateRefreshToken(
        { id: currentSessionId, userId, refreshToken },
        { session },
      )

      if (isNil(currentSession)) {
        throw new UnauthorizedException(DICTIONARY.auth.unauthorized)
      }

      await this.sessionRepository.deleteOthers(
        { userId, id: currentSessionId },
        { session },
      )

      return { accessCode, accessToken: newAccessToken, refreshToken }
    })

    requestContext.set("userId", payload.sub)

    return {
      tokens: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      },
      response: {
        accessCode: result.accessCode,
      } satisfies LoginCodeResponseDto,
    }
  }

  async register(userAgent: string | undefined) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        const { userId, ...registration } = await this.transactionService.run(
          async (session) => {
            const { user, accessCode } = await this.userRepository.createNew({
              session,
            })
            const { accessToken, refreshToken } = await this.createSession({
              userId: user._id,
              role: user.role,
              userAgent,
              session,
            })

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

        return {
          tokens: {
            accessToken: registration.accessToken,
            refreshToken: registration.refreshToken,
          },
          response: {
            username: registration.username,
            accessCode: registration.accessCode,
          } satisfies RegisterResponseDto,
        }
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

  private async createSession(props: ICreateAuthSessionProps) {
    const { userId, role, userAgent, session } = props
    const sessionId = new Types.ObjectId()
    const tokens = await this.issueTokens({
      sub: userId.toHexString(),
      sessionId: sessionId.toHexString(),
      role,
    })

    await this.sessionRepository.createNew(
      {
        id: sessionId,
        userId,
        refreshToken: tokens.refreshToken,
        userAgent,
        country: getCountryByIp(requestContext.get("ip")),
      },
      { session },
    )

    return tokens
  }
}

export { AuthService }
