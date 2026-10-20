import {
  Body,
  Controller,
  Header,
  HttpCode,
  Patch,
  Post,
  Res,
} from "@nestjs/common"
import { ApiTags } from "@nestjs/swagger"
import { Throttle } from "@nestjs/throttler"

import { ApiEndpoint } from "@infrastructure/logger/decorators/ApiEndpoint"
import { SecurityCookieService } from "@infrastructure/security/services/cookie.service"
import { SWAGGER_DICTIONARY } from "@entities/shared/static/SWAGGER_DICTIONARY"

import { PasswordResetBodyDto } from "../dto/body/passwordReset.body"
import { PasswordResetService } from "../services/passwordReset.service"
import { ConfirmPasswordResetBodyDto } from "../dto/body/confirmPasswordReset.body"

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
  @ApiEndpoint({
    operationId: "AuthController_confirmPasswordReset",
    summary: SWAGGER_DICTIONARY.auth.confirmPasswordReset.summary,
    description: SWAGGER_DICTIONARY.auth.confirmPasswordReset.description,
    response: {
      status: 204,
      description: SWAGGER_DICTIONARY.auth.confirmPasswordReset.response,
      headers: {
        "Set-Cookie": {
          description: SWAGGER_DICTIONARY.common.clearAuthCookies,
          schema: { type: "string" },
        },
      },
    },
    errors: [
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
  @ApiEndpoint({
    operationId: "AuthController_requestPasswordReset",
    summary: SWAGGER_DICTIONARY.auth.requestPasswordReset.summary,
    description: SWAGGER_DICTIONARY.auth.requestPasswordReset.description,
    response: {
      status: 204,
      description: SWAGGER_DICTIONARY.auth.requestPasswordReset.response,
    },
    errors: [
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
