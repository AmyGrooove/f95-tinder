import {
  Body,
  Controller,
  Header,
  HttpCode,
  Patch,
  Post,
  Res,
} from "@nestjs/common"
import { ApiConsumes, ApiTags } from "@nestjs/swagger"
import { Throttle } from "@nestjs/throttler"

import {
  ApiEndpoint,
  SWAGGER_RESPONSE_HEADERS,
} from "@infrastructure/logger/decorators/ApiEndpoint"
import { SecurityCookieService } from "@infrastructure/security/services/cookieService"
import { SWAGGER_DICTIONARY } from "@endpoints/shared/static/SWAGGER_DICTIONARY"
import { SWAGGER_REQUEST_ERRORS } from "@endpoints/shared/static/SWAGGER_REQUEST_ERRORS"

import {
  PasswordResetBodyDto,
  PasswordResetService,
  ConfirmPasswordResetBodyDto,
} from "@endpoints/auth/services/passwordResetService"

@ApiTags(SWAGGER_DICTIONARY.tags.passwordReset)
@Controller("auth/password/reset")
class PasswordResetController {
  constructor(
    private readonly passwordResetService: PasswordResetService,
    private readonly securityCookieService: SecurityCookieService,
  ) {}

  @Patch()
  @HttpCode(204)
  @Header("Cache-Control", "no-store")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiConsumes("application/json", "application/x-www-form-urlencoded")
  @ApiEndpoint({
    operationId: "AuthController_confirmPasswordReset",
    summary: SWAGGER_DICTIONARY.auth.confirmPasswordReset.summary,
    description: SWAGGER_DICTIONARY.auth.confirmPasswordReset.description,
    response: {
      status: 204,
      description: SWAGGER_DICTIONARY.auth.confirmPasswordReset.response,
      headers: {
        ...SWAGGER_RESPONSE_HEADERS.noStore,
        "Set-Cookie": {
          description: SWAGGER_DICTIONARY.common.clearAuthCookies,
          schema: { type: "string" },
        },
      },
    },
    errors: [
      SWAGGER_REQUEST_ERRORS.bodyTooLarge,
      SWAGGER_REQUEST_ERRORS.unsupportedMediaType,
      {
        status: 400,
        description:
          SWAGGER_DICTIONARY.auth.confirmPasswordReset.errors.status400,
      },
      { status: 403, description: SWAGGER_DICTIONARY.common.csrfFailed },
      {
        status: 429,
        description:
          SWAGGER_DICTIONARY.auth.confirmPasswordReset.errors.status429,
      },
    ],
  })
  async confirmPasswordReset(
    @Body() body: ConfirmPasswordResetBodyDto,
    @Res({ passthrough: true }) reply: unknown,
  ) {
    await this.passwordResetService.confirmReset(body)

    this.securityCookieService.clearAuthCookies(reply)
  }

  @Post()
  @HttpCode(204)
  @Header("Cache-Control", "no-store")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiConsumes("application/json", "application/x-www-form-urlencoded")
  @ApiEndpoint({
    operationId: "AuthController_requestPasswordReset",
    summary: SWAGGER_DICTIONARY.auth.requestPasswordReset.summary,
    description: SWAGGER_DICTIONARY.auth.requestPasswordReset.description,
    response: {
      status: 204,
      description: SWAGGER_DICTIONARY.auth.requestPasswordReset.response,
      headers: SWAGGER_RESPONSE_HEADERS.noStore,
    },
    errors: [
      SWAGGER_REQUEST_ERRORS.bodyTooLarge,
      SWAGGER_REQUEST_ERRORS.unsupportedMediaType,
      { status: 400, description: SWAGGER_DICTIONARY.common.invalidRequest },
      { status: 403, description: SWAGGER_DICTIONARY.common.csrfFailed },
      {
        status: 429,
        description:
          SWAGGER_DICTIONARY.auth.requestPasswordReset.errors.status429,
      },
    ],
  })
  async requestPasswordReset(@Body() body: PasswordResetBodyDto) {
    await this.passwordResetService.requestReset(body)
  }
}

export { PasswordResetController }
