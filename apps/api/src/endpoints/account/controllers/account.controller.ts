import {
  Body,
  Controller,
  Cookies,
  Header,
  HttpCode,
  Patch,
  Get,
} from "@nestjs/common"
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger"

import { ApiEndpoint } from "@infrastructure/logger/decorators/ApiEndpoint"
import { SWAGGER_DICTIONARY } from "@entities/shared/static/SWAGGER_DICTIONARY"

import { DisplayNameBodyDto } from "../dto/body/displayName.body"
import { UsernameBodyDto } from "../dto/body/username.body"
import { WhoamiResponseDto } from "../dto/response/whoami.response"
import { AccountService } from "../services/account.service"

@ApiTags(SWAGGER_DICTIONARY.tags.account)
@Controller("account")
class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Patch("displayName")
  @HttpCode(204)
  @Header("Cache-Control", "no-store")
  @ApiCookieAuth("accessCookie")
  @ApiEndpoint({
    operationId: "AccountController_updateDisplayName",
    summary: SWAGGER_DICTIONARY.account.updateDisplayName.summary,
    description: SWAGGER_DICTIONARY.account.updateDisplayName.description,
    response: {
      status: 204,
      description: SWAGGER_DICTIONARY.account.updateDisplayName.response,
    },
    errors: [
      { status: 400, description: SWAGGER_DICTIONARY.common.invalidRequest },
      {
        status: 401,
        description: SWAGGER_DICTIONARY.common.unauthorized,
      },
      { status: 403, description: SWAGGER_DICTIONARY.common.csrfFailed },
      { status: 429, description: SWAGGER_DICTIONARY.common.rateLimitExceeded },
    ],
  })
  updateDisplayName(
    @Cookies("__Host-accessToken") accessToken: unknown,
    @Body() body: DisplayNameBodyDto,
  ) {
    return this.accountService.updateDisplayName(accessToken, body)
  }

  @Patch("username")
  @HttpCode(204)
  @Header("Cache-Control", "no-store")
  @ApiCookieAuth("accessCookie")
  @ApiEndpoint({
    operationId: "AccountController_updateUsername",
    summary: SWAGGER_DICTIONARY.account.updateUsername.summary,
    description: SWAGGER_DICTIONARY.account.updateUsername.description,
    response: {
      status: 204,
      description: SWAGGER_DICTIONARY.account.updateUsername.response,
    },
    errors: [
      { status: 400, description: SWAGGER_DICTIONARY.common.invalidRequest },
      {
        status: 401,
        description: SWAGGER_DICTIONARY.common.unauthorized,
      },
      { status: 403, description: SWAGGER_DICTIONARY.common.csrfFailed },
      {
        status: 409,
        description: SWAGGER_DICTIONARY.account.updateUsername.errors.status409,
      },
      { status: 429, description: SWAGGER_DICTIONARY.common.rateLimitExceeded },
    ],
  })
  updateUsername(
    @Cookies("__Host-accessToken") accessToken: unknown,
    @Body() body: UsernameBodyDto,
  ) {
    return this.accountService.updateUsername(accessToken, body)
  }

  @Get("whoami")
  @Header("Cache-Control", "no-store")
  @ApiCookieAuth("accessCookie")
  @ApiEndpoint({
    operationId: "AccountController_whoami",
    summary: SWAGGER_DICTIONARY.account.whoami.summary,
    description: SWAGGER_DICTIONARY.account.whoami.description,
    response: {
      status: 200,
      type: WhoamiResponseDto,
      description: SWAGGER_DICTIONARY.account.whoami.response,
    },
    errors: [
      {
        status: 401,
        description: SWAGGER_DICTIONARY.common.unauthorized,
      },
      { status: 429, description: SWAGGER_DICTIONARY.common.rateLimitExceeded },
    ],
  })
  whoami(@Cookies("__Host-accessToken") accessToken: unknown) {
    return this.accountService.whoami(accessToken)
  }
}

export { AccountController }
