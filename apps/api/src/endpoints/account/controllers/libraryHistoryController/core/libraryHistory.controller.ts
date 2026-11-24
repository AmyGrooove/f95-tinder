import {
  Body,
  Controller,
  Cookies,
  Header,
  HttpCode,
  QueryMethod,
  UseInterceptors,
} from "@nestjs/common"
import { ApiBody, ApiConsumes, ApiCookieAuth, ApiTags } from "@nestjs/swagger"

import {
  LibraryHistoryBodyDto,
  LibraryHistoryResponseDto,
  LibraryHistoryService,
} from "@endpoints/account/services/libraryHistoryService"
import { SWAGGER_DICTIONARY } from "@endpoints/shared/static/SWAGGER_DICTIONARY"
import { ApiEndpoint } from "@infrastructure/logger/decorators/ApiEndpoint"

import { AccountLibraryRequestInterceptor } from "../../../interceptors/accountLibraryRequest.interceptor"

const {
  common,
  tags,
  account: { libraryHistory },
} = SWAGGER_DICTIONARY

@ApiTags(tags.account)
@ApiCookieAuth("accessCookie")
@Controller("account/library")
class LibraryHistoryController {
  constructor(private readonly libraryHistoryService: LibraryHistoryService) {}

  @QueryMethod("history")
  @UseInterceptors(AccountLibraryRequestInterceptor)
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @Header("Accept-Query", "application/json")
  @ApiConsumes("application/json")
  @ApiBody({ type: LibraryHistoryBodyDto, required: true })
  @ApiEndpoint({
    operationId: "LibraryHistoryController_readPage",
    summary: libraryHistory.summary,
    description: libraryHistory.description,
    response: {
      status: 200,
      type: LibraryHistoryResponseDto,
      description: libraryHistory.response,
      headers: {
        "Accept-Query": {
          schema: { type: "string", enum: ["application/json"] },
        },
        "Cache-Control": { schema: { type: "string", enum: ["no-store"] } },
      },
    },
    errors: [
      { status: 400, description: common.invalidRequest },
      { status: 401, description: common.unauthorized },
      { status: 403, description: common.csrfFailed },
      { status: 429, description: common.rateLimitExceeded },
    ],
  })
  readPage(
    @Cookies("__Host-accessToken") accessToken: unknown,
    @Body() body: LibraryHistoryBodyDto,
  ) {
    return this.libraryHistoryService.readPage(accessToken, body)
  }
}

export { LibraryHistoryController }
