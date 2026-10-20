import {
  Body,
  Controller,
  Cookies,
  Header,
  HttpCode,
  Patch,
  Res,
} from "@nestjs/common"
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger"
import { Throttle } from "@nestjs/throttler"

import { ApiEndpoint } from "@infrastructure/logger/decorators/ApiEndpoint"
import { SecurityCookieService } from "@infrastructure/security/services/cookie.service"
import {
  LoginCodeResponseDto,
  LoginCodeBodyDto,
  AuthService,
} from "@endpoints/auth"
import { SWAGGER_DICTIONARY } from "@entities/shared/static/SWAGGER_DICTIONARY"

import { AccountService } from "../services/account.service"
import { PasswordBodyDto } from "../dto/body/password.body"

@ApiTags(SWAGGER_DICTIONARY.tags.accountCredentials)
@Controller()
class AccountCredentialsController {
  constructor(
    private readonly accountService: AccountService,
    private readonly authService: AuthService,
    private readonly securityCookieService: SecurityCookieService,
  ) {}

  @Patch("account/password")
  @HttpCode(204)
  @Header("Cache-Control", "no-store")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiCookieAuth("accessCookie")
  @ApiEndpoint({
    operationId: "AccountController_updatePassword",
    summary: SWAGGER_DICTIONARY.account.updatePassword.summary,
    description: SWAGGER_DICTIONARY.account.updatePassword.description,
    response: {
      status: 204,
      description: SWAGGER_DICTIONARY.account.updatePassword.response,
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
        description: SWAGGER_DICTIONARY.common.invalidSessionOrPassword,
      },
      { status: 403, description: SWAGGER_DICTIONARY.common.csrfFailed },
      {
        status: 409,
        description: SWAGGER_DICTIONARY.account.updatePassword.errors.status409,
      },
      {
        status: 429,
        description: SWAGGER_DICTIONARY.account.updatePassword.errors.status429,
      },
    ],
  })
  async updatePassword(
    @Cookies("__Host-accessToken") accessToken: unknown,
    @Body() body: PasswordBodyDto,
    @Res({ passthrough: true }) reply: unknown,
  ) {
    const tokens = await this.accountService.updatePassword(accessToken, body)

    this.securityCookieService.setAuthCookies(reply, tokens)
  }

  @Patch("auth/login/code")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiCookieAuth("accessCookie")
  @ApiEndpoint({
    operationId: "AuthController_reissueCode",
    summary: SWAGGER_DICTIONARY.auth.reissueCode.summary,
    description: SWAGGER_DICTIONARY.auth.reissueCode.description,
    response: {
      status: 200,
      type: LoginCodeResponseDto,
      description: SWAGGER_DICTIONARY.auth.reissueCode.response,
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
        description: SWAGGER_DICTIONARY.common.invalidSessionOrLoginCode,
      },
      { status: 403, description: SWAGGER_DICTIONARY.common.csrfFailed },
      {
        status: 429,
        description: SWAGGER_DICTIONARY.auth.reissueCode.errors.status429,
      },
    ],
  })
  async reissueCode(
    @Cookies("__Host-accessToken") accessToken: unknown,
    @Body() body: LoginCodeBodyDto,
    @Res({ passthrough: true }) reply: unknown,
  ): Promise<LoginCodeResponseDto> {
    const result = await this.authService.reissueCode(accessToken, body)

    this.securityCookieService.setAuthCookies(reply, result)

    return { accessCode: result.accessCode }
  }
}

export { AccountCredentialsController }
