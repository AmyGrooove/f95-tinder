import { Injectable, UnauthorizedException } from "@nestjs/common"
import { JwtService } from "@nestjs/jwt"

import { InfrastructureConfigService } from "@infrastructure/config/services/config.service"

import { JWT_ACCESS_EXPIRATION } from "../static/JWT_ACCESS_EXPIRATION"
import { JWT_ALGORITHM } from "../static/JWT_ALGORITHM"
import { JWT_AUDIENCE } from "../static/JWT_AUDIENCE"
import { JWT_ISSUER } from "../static/JWT_ISSUER"
import { JWT_REFRESH_EXPIRATION } from "../static/JWT_REFRESH_EXPIRATION"
import type { TJwtClaims } from "../types/TJwtClaims"
import type { TJwtPayload } from "../types/TJwtPayload"

@Injectable()
class SecurityJwtService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configurationService: InfrastructureConfigService,
  ) {}

  signAccessToken<TExtension extends object = Record<never, never>>(
    payload: TJwtClaims & TExtension,
  ): Promise<string> {
    return this.jwtService.signAsync(
      {
        ...payload,
        type: "access",
      },
      {
        secret: this.configurationService.jwt.accessSecret,
        algorithm: JWT_ALGORITHM,
        audience: JWT_AUDIENCE,
        expiresIn: JWT_ACCESS_EXPIRATION,
        issuer: JWT_ISSUER,
      },
    )
  }

  signRefreshToken<TExtension extends object = Record<never, never>>(
    payload: TJwtClaims & TExtension,
  ): Promise<string> {
    return this.jwtService.signAsync(
      {
        ...payload,
        type: "refresh",
      },
      {
        secret: this.configurationService.jwt.refreshSecret,
        algorithm: JWT_ALGORITHM,
        audience: JWT_AUDIENCE,
        expiresIn: JWT_REFRESH_EXPIRATION,
        issuer: JWT_ISSUER,
      },
    )
  }

  async verifyAccessToken<TExtension extends object = Record<never, never>>(
    token: string,
  ): Promise<TJwtPayload<TExtension>> {
    try {
      const payload = await this.jwtService.verifyAsync<TJwtPayload<TExtension>>(
        token,
        {
          secret: this.configurationService.jwt.accessSecret,
          algorithms: [JWT_ALGORITHM],
          audience: JWT_AUDIENCE,
          issuer: JWT_ISSUER,
        },
      )

      if (payload.type !== "access") {
        throw new UnauthorizedException("Access token is invalid")
      }

      return payload
    } catch {
      throw new UnauthorizedException("Access token is invalid")
    }
  }

  async verifyRefreshToken<TExtension extends object = Record<never, never>>(
    token: string,
  ): Promise<TJwtPayload<TExtension>> {
    try {
      const payload = await this.jwtService.verifyAsync<TJwtPayload<TExtension>>(
        token,
        {
          secret: this.configurationService.jwt.refreshSecret,
          algorithms: [JWT_ALGORITHM],
          audience: JWT_AUDIENCE,
          issuer: JWT_ISSUER,
        },
      )

      if (payload.type !== "refresh") {
        throw new UnauthorizedException("Refresh token is invalid")
      }

      return payload
    } catch {
      throw new UnauthorizedException("Refresh token is invalid")
    }
  }
}

export { SecurityJwtService }
