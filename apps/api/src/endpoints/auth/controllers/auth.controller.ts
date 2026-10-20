import {
  Body,
  Controller,
  Cookies,
  Header,
  Headers,
  HttpCode,
  Post,
  Res,
} from "@nestjs/common"
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger"
import { Throttle } from "@nestjs/throttler"

import { ApiEndpoint } from "@infrastructure/logger/decorators/ApiEndpoint"
import { SecurityCookieService } from "@infrastructure/security/services/cookie.service"
import { SWAGGER_DICTIONARY } from "@entities/shared/static/SWAGGER_DICTIONARY"

import { RegisterResponseDto } from "../dto/response/register.response"
import { LoginCodeBodyDto } from "../dto/body/loginCode.body"
import { LoginBodyDto } from "../dto/body/login.body"
import { AuthService } from "../services/auth.service"

@ApiTags(SWAGGER_DICTIONARY.tags.auth)
@Controller("auth")
class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly securityCookieService: SecurityCookieService,
  ) {}

  @Post("login")
  @HttpCode(204)
  @Header("Cache-Control", "no-store")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiEndpoint({
    operationId: "AuthController_login",
    summary: SWAGGER_DICTIONARY.auth.login.summary,
    description: SWAGGER_DICTIONARY.auth.login.description,
    response: {
      status: 204,
      description: SWAGGER_DICTIONARY.common.sessionCreated,
      headers: {
        "Set-Cookie": {
          description: SWAGGER_DICTIONARY.common.authCookies,
          schema: { type: "string" },
        },
      },
    },
    errors: [
      { status: 400, description: SWAGGER_DICTIONARY.common.invalidRequest },
      {
        status: 401,
        description: SWAGGER_DICTIONARY.auth.login.errors.status401,
      },
      { status: 403, description: SWAGGER_DICTIONARY.common.csrfFailed },
      {
        status: 429,
        description: SWAGGER_DICTIONARY.common.loginRateLimitExceeded,
      },
    ],
  })
  async login(
    @Body() body: LoginBodyDto,
    @Headers("user-agent") userAgent: string | undefined,
    @Res({ passthrough: true }) reply: unknown,
  ) {
    const tokens = await this.authService.login(body, userAgent)

    this.securityCookieService.setAuthCookies(reply, tokens)
  }

  @Post("login/code")
  @HttpCode(204)
  @Header("Cache-Control", "no-store")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiEndpoint({
    operationId: "AuthController_loginByCode",
    summary: SWAGGER_DICTIONARY.auth.loginByCode.summary,
    description: SWAGGER_DICTIONARY.auth.loginByCode.description,
    response: {
      status: 204,
      description: SWAGGER_DICTIONARY.common.sessionCreated,
      headers: {
        "Set-Cookie": {
          description: SWAGGER_DICTIONARY.common.authCookies,
          schema: { type: "string" },
        },
      },
    },
    errors: [
      { status: 400, description: SWAGGER_DICTIONARY.common.invalidRequest },
      {
        status: 401,
        description: SWAGGER_DICTIONARY.auth.loginByCode.errors.status401,
      },
      { status: 403, description: SWAGGER_DICTIONARY.common.csrfFailed },
      {
        status: 429,
        description: SWAGGER_DICTIONARY.common.loginRateLimitExceeded,
      },
    ],
  })
  async loginByCode(
    @Body() body: LoginCodeBodyDto,
    @Headers("user-agent") userAgent: string | undefined,
    @Res({ passthrough: true }) reply: unknown,
  ) {
    const tokens = await this.authService.loginByCode(body, userAgent)

    this.securityCookieService.setAuthCookies(reply, tokens)
  }

  @Post("logout")
  @HttpCode(204)
  @Header("Cache-Control", "no-store")
  @ApiCookieAuth("accessCookie")
  @ApiEndpoint({
    operationId: "AuthController_logout",
    summary: SWAGGER_DICTIONARY.auth.logout.summary,
    description: SWAGGER_DICTIONARY.auth.logout.description,
    response: {
      status: 204,
      description: SWAGGER_DICTIONARY.auth.logout.response,
      headers: {
        "Set-Cookie": {
          description: SWAGGER_DICTIONARY.common.clearAuthCookies,
          schema: { type: "string" },
        },
      },
    },
    errors: [
      {
        status: 401,
        description: SWAGGER_DICTIONARY.common.unauthorized,
      },
      { status: 403, description: SWAGGER_DICTIONARY.common.csrfFailed },
      { status: 429, description: SWAGGER_DICTIONARY.common.rateLimitExceeded },
    ],
  })
  async logout(
    @Cookies("__Host-accessToken") accessToken: unknown,
    @Res({ passthrough: true }) reply: unknown,
  ) {
    await this.authService.logout(accessToken)

    this.securityCookieService.clearAuthCookies(reply)
  }

  @Post("register")
  @Header("Cache-Control", "no-store")
  @Throttle({ default: { limit: 2, ttl: 60_000 } })
  @ApiEndpoint({
    operationId: "AuthController_register",
    summary: SWAGGER_DICTIONARY.auth.register.summary,
    description: SWAGGER_DICTIONARY.auth.register.description,
    response: {
      status: 201,
      type: RegisterResponseDto,
      description: SWAGGER_DICTIONARY.auth.register.response,
      headers: {
        "Set-Cookie": {
          description: SWAGGER_DICTIONARY.common.authCookies,
          schema: { type: "string" },
        },
      },
    },
    errors: [
      { status: 403, description: SWAGGER_DICTIONARY.common.csrfFailed },
      {
        status: 429,
        description: SWAGGER_DICTIONARY.auth.register.errors.status429,
      },
      {
        status: 503,
        description: SWAGGER_DICTIONARY.auth.register.errors.status503,
      },
    ],
  })
  async register(
    @Headers("user-agent") userAgent: string | undefined,
    @Res({ passthrough: true }) reply: unknown,
  ): Promise<RegisterResponseDto> {
    const result = await this.authService.register(userAgent)

    this.securityCookieService.setAuthCookies(reply, result)

    return { username: result.username, accessCode: result.accessCode }
  }
}

export { AuthController }
