import {
  Body,
  Controller,
  Cookies,
  Header,
  HttpCode,
  Patch,
  Post,
} from "@nestjs/common"
import { ApiConsumes, ApiCookieAuth, ApiTags } from "@nestjs/swagger"
import { Throttle } from "@nestjs/throttler"

import {
  ApiEndpoint,
  SWAGGER_RESPONSE_HEADERS,
} from "@infrastructure/logger/decorators/ApiEndpoint"
import { SWAGGER_DICTIONARY } from "@endpoints/shared/static/SWAGGER_DICTIONARY"
import { SWAGGER_REQUEST_ERRORS } from "@endpoints/shared/static/SWAGGER_REQUEST_ERRORS"

import {
  AccountSetupService,
  SetupBodyDto,
  ConfirmSetupBodyDto,
} from "@endpoints/account/services/accountSetupService"

@ApiTags(SWAGGER_DICTIONARY.tags.accountSetup)
@Controller("account/credentials")
class AccountSetupController {
  constructor(private readonly accountSetupService: AccountSetupService) {}

  @Patch()
  @HttpCode(204)
  @Header("Cache-Control", "no-store")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiCookieAuth("accessCookie")
  @ApiConsumes("application/json", "application/x-www-form-urlencoded")
  @ApiEndpoint({
    operationId: "AccountController_confirmSetup",
    summary: SWAGGER_DICTIONARY.account.confirmSetup.summary,
    description: SWAGGER_DICTIONARY.account.confirmSetup.description,
    response: {
      status: 204,
      description: SWAGGER_DICTIONARY.account.confirmSetup.response,
      headers: SWAGGER_RESPONSE_HEADERS.noStore,
    },
    errors: [
      SWAGGER_REQUEST_ERRORS.bodyTooLarge,
      SWAGGER_REQUEST_ERRORS.unsupportedMediaType,
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
        description: SWAGGER_DICTIONARY.common.setupUnavailableOrEmailTaken,
      },
      { status: 429, description: SWAGGER_DICTIONARY.common.rateLimitExceeded },
    ],
  })
  confirmSetup(
    @Cookies("__Host-accessToken") accessToken: unknown,
    @Body() body: ConfirmSetupBodyDto,
  ) {
    return this.accountSetupService.confirmSetup(accessToken, body)
  }

  @Post()
  @HttpCode(204)
  @Header("Cache-Control", "no-store")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiCookieAuth("accessCookie")
  @ApiConsumes("application/json", "application/x-www-form-urlencoded")
  @ApiEndpoint({
    operationId: "AccountController_requestSetup",
    summary: SWAGGER_DICTIONARY.account.requestSetup.summary,
    description: SWAGGER_DICTIONARY.account.requestSetup.description,
    response: {
      status: 204,
      description: SWAGGER_DICTIONARY.common.mailQueued,
      headers: SWAGGER_RESPONSE_HEADERS.noStore,
    },
    errors: [
      SWAGGER_REQUEST_ERRORS.bodyTooLarge,
      SWAGGER_REQUEST_ERRORS.unsupportedMediaType,
      { status: 400, description: SWAGGER_DICTIONARY.common.invalidRequest },
      {
        status: 401,
        description: SWAGGER_DICTIONARY.common.invalidSessionOrLoginCode,
      },
      { status: 403, description: SWAGGER_DICTIONARY.common.csrfFailed },
      {
        status: 409,
        description: SWAGGER_DICTIONARY.common.setupUnavailableOrEmailTaken,
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
  requestSetup(
    @Cookies("__Host-accessToken") accessToken: unknown,
    @Body() body: SetupBodyDto,
  ) {
    return this.accountSetupService.requestSetup(accessToken, body)
  }
}

export { AccountSetupController }
