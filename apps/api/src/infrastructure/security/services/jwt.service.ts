import { Injectable, UnauthorizedException } from "@nestjs/common"
import { JwtService } from "@nestjs/jwt"

import { InfrastructureConfigService } from "@infrastructure/config/services/config.service"
import { isArray } from "@shared/functions/checks/isArray"
import { isString } from "@shared/functions/checks/isString"

import { JWT_ACCESS_EXPIRATION } from "../static/JWT_ACCESS_EXPIRATION"
import { JWT_ALGORITHM } from "../static/JWT_ALGORITHM"
import { JWT_REFRESH_EXPIRATION } from "../static/JWT_REFRESH_EXPIRATION"
import type { IAccessTokenPayload } from "../types/IAccessTokenPayload"
import type { IRefreshTokenPayload } from "../types/IRefreshTokenPayload"

@Injectable()
class SecurityJwtService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configurationService: InfrastructureConfigService,
  ) {}

  signAccessToken(payload: Omit<IAccessTokenPayload, "type">): Promise<string> {
    const appName = this.configurationService.app.name

    return this.jwtService.signAsync(
      {
        sub: payload.sub,
        sessionId: payload.sessionId,
        roles: payload.roles,
        type: "access",
      },
      {
        secret: this.configurationService.jwt.accessSecret,
        algorithm: JWT_ALGORITHM,
        audience: `${appName}-api`,
        expiresIn: JWT_ACCESS_EXPIRATION,
        issuer: appName,
      },
    )
  }

  signRefreshToken(
    payload: Omit<IRefreshTokenPayload, "type">,
  ): Promise<string> {
    const appName = this.configurationService.app.name

    return this.jwtService.signAsync(
      {
        sub: payload.sub,
        sessionId: payload.sessionId,
        type: "refresh",
      },
      {
        secret: this.configurationService.jwt.refreshSecret,
        algorithm: JWT_ALGORITHM,
        audience: `${appName}-api`,
        expiresIn: JWT_REFRESH_EXPIRATION,
        issuer: appName,
      },
    )
  }

  async verifyAccessToken(token: string): Promise<IAccessTokenPayload> {
    try {
      const appName = this.configurationService.app.name
      const payload = await this.jwtService.verifyAsync<IAccessTokenPayload>(
        token,
        {
          secret: this.configurationService.jwt.accessSecret,
          algorithms: [JWT_ALGORITHM],
          audience: `${appName}-api`,
          issuer: appName,
        },
      )

      if (
        payload.type !== "access" ||
        !isString(payload.sub) ||
        !isString(payload.sessionId) ||
        !isArray(payload.roles) ||
        !payload.roles.every(isString)
      ) {
        throw new UnauthorizedException("Access token is invalid")
      }

      return payload
    } catch {
      throw new UnauthorizedException("Access token is invalid")
    }
  }

  async verifyRefreshToken(token: string): Promise<IRefreshTokenPayload> {
    try {
      const appName = this.configurationService.app.name
      const payload = await this.jwtService.verifyAsync<IRefreshTokenPayload>(
        token,
        {
          secret: this.configurationService.jwt.refreshSecret,
          algorithms: [JWT_ALGORITHM],
          audience: `${appName}-api`,
          issuer: appName,
        },
      )

      if (
        payload.type !== "refresh" ||
        !isString(payload.sub) ||
        !isString(payload.sessionId) ||
        "roles" in payload
      ) {
        throw new UnauthorizedException("Refresh token is invalid")
      }

      return payload
    } catch {
      throw new UnauthorizedException("Refresh token is invalid")
    }
  }
}

export { SecurityJwtService }
