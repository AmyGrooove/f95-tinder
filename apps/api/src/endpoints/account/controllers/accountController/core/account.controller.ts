import {
  Body,
  Controller,
  Cookies,
  Header,
  HttpCode,
  Patch,
  Get,
  QueryMethod,
  UseInterceptors,
} from "@nestjs/common"
import { ApiBody, ApiConsumes, ApiCookieAuth, ApiTags } from "@nestjs/swagger"

import {
  ApiEndpoint,
  SWAGGER_RESPONSE_HEADERS,
} from "@infrastructure/logger/decorators/ApiEndpoint"
import { LibraryQueryRequestInterceptor } from "@endpoints/shared/interceptors/libraryQueryRequestInterceptor"
import { SWAGGER_DICTIONARY } from "@endpoints/shared/static/SWAGGER_DICTIONARY"
import { SWAGGER_REQUEST_ERRORS } from "@endpoints/shared/static/SWAGGER_REQUEST_ERRORS"

import {
  DisplayNameBodyDto,
  UsernameBodyDto,
  WhoamiResponseDto,
  AccountService,
  LibraryContinueBodyDto,
  LibraryContinueResponseDto,
} from "@endpoints/account/services/accountService"

@ApiTags(SWAGGER_DICTIONARY.tags.account)
@Controller("account")
class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Patch("displayName")
  @HttpCode(204)
  @Header("Cache-Control", "no-store")
  @ApiCookieAuth("accessCookie")
  @ApiConsumes("application/json", "application/x-www-form-urlencoded")
  @ApiEndpoint({
    operationId: "AccountController_updateDisplayName",
    summary: SWAGGER_DICTIONARY.account.updateDisplayName.summary,
    description: SWAGGER_DICTIONARY.account.updateDisplayName.description,
    response: {
      status: 204,
      description: SWAGGER_DICTIONARY.account.updateDisplayName.response,
      headers: SWAGGER_RESPONSE_HEADERS.noStore,
    },
    errors: [
      SWAGGER_REQUEST_ERRORS.bodyTooLarge,
      SWAGGER_REQUEST_ERRORS.unsupportedMediaType,
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
  @ApiConsumes("application/json", "application/x-www-form-urlencoded")
  @ApiEndpoint({
    operationId: "AccountController_updateUsername",
    summary: SWAGGER_DICTIONARY.account.updateUsername.summary,
    description: SWAGGER_DICTIONARY.account.updateUsername.description,
    response: {
      status: 204,
      description: SWAGGER_DICTIONARY.account.updateUsername.response,
      headers: SWAGGER_RESPONSE_HEADERS.noStore,
    },
    errors: [
      SWAGGER_REQUEST_ERRORS.bodyTooLarge,
      SWAGGER_REQUEST_ERRORS.unsupportedMediaType,
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
      headers: SWAGGER_RESPONSE_HEADERS.noStore,
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

  @QueryMethod("library/continue")
  @UseInterceptors(LibraryQueryRequestInterceptor)
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @Header("Accept-Query", "application/json")
  @ApiCookieAuth("accessCookie")
  @ApiBody({
    type: LibraryContinueBodyDto,
    required: true,
    examples: {
      allTypes: {
        summary: "Продолжить для всех типов произведений",
        value: {},
      },
    },
  })
  @ApiConsumes("application/json")
  @ApiEndpoint({
    operationId: "AccountController_readLibraryContinue",
    summary: SWAGGER_DICTIONARY.account.libraryContinue.summary,
    description: SWAGGER_DICTIONARY.account.libraryContinue.description,
    response: {
      status: 200,
      type: LibraryContinueResponseDto,
      description: SWAGGER_DICTIONARY.account.libraryContinue.response,
      headers: SWAGGER_RESPONSE_HEADERS.jsonQuery,
      examples: {
        inProgress: {
          summary: "Есть произведение в процессе",
          value: { status: "inProgress" },
        },
      },
    },
    errors: [
      SWAGGER_REQUEST_ERRORS.bodyTooLarge,
      SWAGGER_REQUEST_ERRORS.unsupportedMediaType,
      { status: 400, description: SWAGGER_DICTIONARY.common.invalidRequest },
      { status: 401, description: SWAGGER_DICTIONARY.common.unauthorized },
      { status: 403, description: SWAGGER_DICTIONARY.common.csrfFailed },
      { status: 429, description: SWAGGER_DICTIONARY.common.rateLimitExceeded },
      {
        status: 500,
        description: SWAGGER_DICTIONARY.account.libraryContinue.internalError,
      },
    ],
  })
  readLibraryContinue(
    @Cookies("__Host-accessToken") accessToken: unknown,
    @Body() body: LibraryContinueBodyDto,
  ) {
    return this.accountService.readLibraryContinue(accessToken, body)
  }
}

export { AccountController }
