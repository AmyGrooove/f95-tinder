import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common"
import { mongo, Types } from "mongoose"

import { AuthService } from "@endpoints/auth"

import { SessionRepository } from "@entities/session/services/session.repository"
import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { UserRepository } from "@entities/user/services/user.repository"
import { MongoTransactionService } from "@infrastructure/database/services/mongoTransaction.service"
import { compareHash } from "@infrastructure/security/functions/compareHash"
import { hashValue } from "@infrastructure/security/functions/hashValue"
import { isNil } from "@shared/functions/checks/isNil"
import { requestContext } from "@shared/functions/context/requestContext"

import type { WhoamiResponseDto } from "../dto/response/whoami.response"
import type { AccountResponseDto } from "../dto/response/account.response"
import type { UsernameBodyDto } from "../dto/body/username.body"
import type { DisplayNameBodyDto } from "../dto/body/displayName.body"
import type { PasswordBodyDto } from "../dto/body/password.body"

@Injectable()
class AccountService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly authService: AuthService,
    private readonly transactionService: MongoTransactionService,
  ) {}

  async updatePassword(accessToken: unknown, body: PasswordBodyDto) {
    const payload = await this.authService.verifyAccessToken(accessToken)

    const userId = new Types.ObjectId(payload.sub)
    const currentSessionId = new Types.ObjectId(payload.sessionId)
    const [currentSession, user] = await Promise.all([
      this.authService.getSession(payload),
      this.userRepository.read.findById(payload.sub, {
        _id: 1,
        passwordHash: 1,
      }),
    ])

    if (isNil(currentSession) || isNil(user)) {
      throw new UnauthorizedException(DICTIONARY.auth.unauthorized)
    }

    if (isNil(user.passwordHash)) {
      throw new ConflictException(DICTIONARY.account.passwordUnavailable)
    }

    const isPasswordValid = await compareHash(
      body.currentPassword,
      user.passwordHash,
    )

    if (!isPasswordValid) {
      throw new UnauthorizedException(DICTIONARY.account.invalidPassword)
    }

    const passwordHash = await hashValue(body.newPassword)
    const result = await this.transactionService.run(async (session) => {
      const updatedUser = await this.userRepository.write.updateByFilter(
        { _id: userId, passwordHash: user.passwordHash },
        { $set: { passwordHash } },
        { session, projection: { _id: 1, role: 1 } },
      )

      if (isNil(updatedUser)) {
        throw new UnauthorizedException(DICTIONARY.account.invalidPassword)
      }

      const tokens = await this.authService.issueTokens({
        sub: payload.sub,
        sessionId: payload.sessionId,
        role: updatedUser.role,
      })
      const updatedSession = await this.sessionRepository.updateRefreshToken(
        {
          id: currentSessionId,
          userId,
          refreshToken: tokens.refreshToken,
        },
        { session },
      )

      if (isNil(updatedSession)) {
        throw new UnauthorizedException(DICTIONARY.auth.unauthorized)
      }

      await this.sessionRepository.deleteOthers(
        { userId, id: currentSessionId },
        { session },
      )

      return tokens
    })

    requestContext.set("userId", payload.sub)

    return result
  }

  async updateDisplayName(accessToken: unknown, body: DisplayNameBodyDto) {
    const payload = await this.authService.verifyAccessToken(accessToken)

    const session = await this.authService.getSession(payload)

    if (isNil(session)) {
      throw new UnauthorizedException(DICTIONARY.auth.unauthorized)
    }

    const user = await this.userRepository.write.updateById(
      payload.sub,
      { $set: { displayName: body.displayName } },
      { projection: { _id: 1 } },
    )

    if (isNil(user)) {
      throw new UnauthorizedException(DICTIONARY.auth.unauthorized)
    }

    requestContext.set("userId", user._id.toHexString())
  }

  async updateUsername(accessToken: unknown, body: UsernameBodyDto) {
    const payload = await this.authService.verifyAccessToken(accessToken)

    const session = await this.authService.getSession(payload)

    if (isNil(session)) {
      throw new UnauthorizedException(DICTIONARY.auth.unauthorized)
    }

    try {
      const user = await this.userRepository.write.updateById(
        payload.sub,
        { $set: { username: body.username } },
        { projection: { _id: 1 } },
      )

      if (isNil(user)) {
        throw new UnauthorizedException(DICTIONARY.auth.unauthorized)
      }

      requestContext.set("userId", user._id.toHexString())
    } catch (error) {
      if (
        error instanceof mongo.MongoServerError &&
        error.code === 11000 &&
        error.keyPattern?.username === 1
      ) {
        throw new ConflictException(DICTIONARY.account.usernameTaken)
      }

      throw error
    }
  }

  async getAccount(accessToken: unknown): Promise<AccountResponseDto> {
    const payload = await this.authService.verifyAccessToken(accessToken)

    const [session, user] = await Promise.all([
      this.authService.getSession(payload),
      this.userRepository.read.findById(payload.sub, {
        _id: 1,
        username: 1,
        displayName: 1,
        avatarUrl: 1,
        role: 1,
        email: 1,
        passwordHash: 1,
        accessCodeHash: 1,
        createdAt: 1,
        updatedAt: 1,
      }),
    ])

    if (isNil(session) || isNil(user)) {
      throw new UnauthorizedException(DICTIONARY.auth.unauthorized)
    }

    requestContext.set("userId", user._id.toHexString())

    return {
      id: user._id.toHexString(),
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      email: user.email,
      isPasswordSet: !isNil(user.passwordHash),
      isAccessCodeSet: !isNil(user.accessCodeHash),
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    }
  }

  async whoami(accessToken: unknown): Promise<WhoamiResponseDto> {
    const payload = await this.authService.verifyAccessToken(accessToken)

    const [session, user] = await Promise.all([
      this.authService.getSession(payload),
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
