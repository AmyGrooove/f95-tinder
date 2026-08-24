import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common"
import { Types } from "mongoose"

import { SessionRepository } from "@entities/session/services/session.repository"
import { UserRepository } from "@entities/user/services/user.repository"
import { compareHash } from "@infrastructure/security/functions/compareHash"
import { hashValue } from "@infrastructure/security/functions/hashValue"
import { SecurityJwtService } from "@infrastructure/security/services/jwt.service"

import type { UserDocument } from "@entities/user/schemas/user.schema"
import type {
  AuthSessionResponseDto,
  AuthUserDto,
} from "../dto/response/auth-session.response"
import type { LoginBodyDto } from "../dto/body/login.body"
import type { RefreshBodyDto } from "../dto/body/refresh.body"
import type { RegisterBodyDto } from "../dto/body/register.body"

@Injectable()
class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly securityJwtService: SecurityJwtService,
  ) {}

  async register(
    registerBody: RegisterBodyDto,
  ): Promise<AuthSessionResponseDto> {
    const email = registerBody.email.trim().toLowerCase()
    const existingUser = await this.userRepository.findByEmail(email)

    if (existingUser) {
      throw new ConflictException("User with this email already exists")
    }

    const passwordHash = await hashValue(registerBody.password)
    const user = await this.userRepository.createUser({
      _id: new Types.ObjectId(),
      email,
      passwordHash,
      displayName: registerBody.displayName.trim(),
      role: "user",
      status: "active",
      lastLoginAt: new Date(),
    })

    return this.createAuthSession(user)
  }

  async login(loginBody: LoginBodyDto): Promise<AuthSessionResponseDto> {
    const email = loginBody.email.trim().toLowerCase()
    const user = await this.userRepository.findByEmail(email)

    if (!user || user.status !== "active") {
      throw new UnauthorizedException("Email or password is invalid")
    }

    const isPasswordValid = await compareHash(
      loginBody.password,
      user.passwordHash,
    )

    if (!isPasswordValid) {
      throw new UnauthorizedException("Email or password is invalid")
    }

    const updatedUser = await this.userRepository.updateLoginDate(
      user._id,
      new Date(),
    )

    return this.createAuthSession(updatedUser ?? user)
  }

  async refresh(refreshBody: RefreshBodyDto): Promise<AuthSessionResponseDto> {
    const payload = await this.securityJwtService.verifyRefreshToken(
      refreshBody.refreshToken,
    )

    if (!payload.sessionId) {
      throw new UnauthorizedException("Refresh token is invalid")
    }

    const session = await this.sessionRepository.findSession(payload.sessionId)

    if (!session || session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException("Refresh token is expired")
    }

    const isRefreshTokenValid = await compareHash(
      refreshBody.refreshToken,
      session.refreshTokenHash,
    )

    if (!isRefreshTokenValid || session.userId.toString() !== payload.sub) {
      throw new UnauthorizedException("Refresh token is invalid")
    }

    const user = await this.userRepository.findById(payload.sub)

    if (!user || user.status !== "active") {
      throw new UnauthorizedException("User is not active")
    }

    await this.sessionRepository.deleteSession(session._id)

    return this.createAuthSession(user)
  }

  async logout(refreshBody: RefreshBodyDto, userId: string): Promise<void> {
    const payload = await this.securityJwtService.verifyRefreshToken(
      refreshBody.refreshToken,
    )

    if (!payload.sessionId || payload.sub !== userId) {
      throw new UnauthorizedException("Refresh token is invalid")
    }

    const session = await this.sessionRepository.findSession(payload.sessionId)

    if (!session) {
      return
    }

    const isRefreshTokenValid = await compareHash(
      refreshBody.refreshToken,
      session.refreshTokenHash,
    )

    if (!isRefreshTokenValid || session.userId.toString() !== payload.sub) {
      throw new UnauthorizedException("Refresh token is invalid")
    }

    await this.sessionRepository.deleteSession(session._id)
  }

  async getSession(userId: string): Promise<AuthUserDto> {
    const user = await this.userRepository.findById(userId)

    if (!user || user.status !== "active") {
      throw new UnauthorizedException("User is not active")
    }

    return this.toAuthUser(user)
  }

  private async createAuthSession(
    user: UserDocument,
  ): Promise<AuthSessionResponseDto> {
    const sessionId = new Types.ObjectId()
    const userId = user._id.toString()
    const refreshToken = await this.securityJwtService.signRefreshToken(
      {
        sub: userId,
        sessionId: sessionId.toString(),
        roles: [user.role],
      },
    )
    const accessToken = await this.securityJwtService.signAccessToken(
      {
        sub: userId,
        sessionId: sessionId.toString(),
        roles: [user.role],
      },
    )
    const refreshTokenHash = await hashValue(refreshToken)
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    await this.sessionRepository.createSession({
      _id: sessionId,
      userId: user._id,
      refreshTokenHash,
      expiresAt,
    })

    return {
      accessToken,
      refreshToken,
      user: this.toAuthUser(user),
    }
  }

  private toAuthUser(user: UserDocument): AuthUserDto {
    return {
      id: user._id.toString(),
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      status: user.status,
      lastLoginAt: user.lastLoginAt,
    }
  }
}

export { AuthService }
