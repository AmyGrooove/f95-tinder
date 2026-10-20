import {
  Body,
  Controller,
  Cookies,
  Header,
  HttpCode,
  Patch,
  Post,
} from "@nestjs/common"
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger"
import { Throttle } from "@nestjs/throttler"

import { ApiEndpoint } from "@infrastructure/logger/decorators/ApiEndpoint"
import { SWAGGER_DICTIONARY } from "@entities/shared/static/SWAGGER_DICTIONARY"

import { EmailBodyDto } from "../dto/body/email.body"
import { ConfirmEmailBodyDto } from "../dto/body/confirmEmail.body"
import { AccountEmailService } from "../services/accountEmail.service"

@ApiTags(SWAGGER_DICTIONARY.tags.accountEmail)
@Controller("account/email")
class AccountEmailController {
  constructor(private readonly accountEmailService: AccountEmailService) {}

  @Patch()
  @HttpCode(204)
  @Header("Cache-Control", "no-store")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiCookieAuth("accessCookie")
  @ApiEndpoint({
    operationId: "AccountController_confirmEmail",
    summary: SWAGGER_DICTIONARY.account.confirmEmail.summary,
    description: SWAGGER_DICTIONARY.account.confirmEmail.description,
    response: {
      status: 204,
      description: SWAGGER_DICTIONARY.account.confirmEmail.response,
    },
    errors: [
      {
        status: 400,
        description: SWAGGER_DICTIONARY.common.invalidConfirmation,
      },
      {
        status: 401,
        description: SWAGGER_DICTIONARY.common.unauthorized,
      },
      { status: 403, description: SWAGGER_DICTIONARY.common.csrfFailed },
      {
        status: 409,
        description: SWAGGER_DICTIONARY.common.setupIncompleteOrEmailTaken,
      },
      { status: 429, description: SWAGGER_DICTIONARY.common.rateLimitExceeded },
    ],
  })
  confirmEmail(
    @Cookies("__Host-accessToken") accessToken: unknown,
    @Body() body: ConfirmEmailBodyDto,
  ) {
    return this.accountEmailService.confirmEmail(accessToken, body)
  }

  @Post()
  @HttpCode(204)
  @Header("Cache-Control", "no-store")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiCookieAuth("accessCookie")
  @ApiEndpoint({
    operationId: "AccountController_requestEmail",
    summary: SWAGGER_DICTIONARY.account.requestEmail.summary,
    description: SWAGGER_DICTIONARY.account.requestEmail.description,
    response: {
      status: 204,
      description: SWAGGER_DICTIONARY.common.mailQueued,
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
        description: SWAGGER_DICTIONARY.common.setupIncompleteOrEmailTaken,
      },
      {
        status: 429,
        description: SWAGGER_DICTIONARY.common.retryLater,
      },
      {
        status: 503,
        description: SWAGGER_DICTIONARY.common.mailQueueUnavailable,
      },
    ],
  })
  requestEmail(
    @Cookies("__Host-accessToken") accessToken: unknown,
    @Body() body: EmailBodyDto,
  ) {
    return this.accountEmailService.requestEmail(accessToken, body)
  }
}

export { AccountEmailController }
