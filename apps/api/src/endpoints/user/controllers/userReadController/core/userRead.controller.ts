import {
  Body,
  Controller,
  Cookies,
  Header,
  HttpCode,
  Param,
  QueryMethod,
  UseInterceptors,
} from "@nestjs/common"
import {
  ApiBody,
  ApiCookieAuth,
  ApiParam,
  ApiSecurity,
  ApiTags,
} from "@nestjs/swagger"
import { Types } from "mongoose"

import { SWAGGER_DICTIONARY } from "@endpoints/shared/static/SWAGGER_DICTIONARY"
import {
  UserLibraryBodyDto,
  UserLibraryResponseDto,
  UserLibraryService,
} from "@endpoints/user/services/userLibraryService"
import { MongoObjectIdHandler } from "@infrastructure/database/services/mongoObjectIdHandler"
import { ApiEndpoint } from "@infrastructure/logger/decorators/ApiEndpoint"
import { REGEX } from "@shared/static/REGEX"

import { UserLibraryRequestInterceptor } from "../interceptors/userLibraryRequest.interceptor"

@ApiTags(SWAGGER_DICTIONARY.tags.users)
@Controller("users")
class UserReadController {
  constructor(private readonly userLibraryService: UserLibraryService) {}

  @QueryMethod(":id/library")
  @UseInterceptors(UserLibraryRequestInterceptor)
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @Header("Accept-Query", "application/json")
  @ApiCookieAuth("accessCookie")
  @ApiSecurity({})
  @ApiParam({
    name: "id",
    required: true,
    description: SWAGGER_DICTIONARY.user.library.ownerId,
    schema: { type: "string", pattern: REGEX.MONGO_OBJECT_ID.source },
  })
  @ApiBody({ type: UserLibraryBodyDto, required: true })
  @ApiEndpoint({
    operationId: "UserReadController_readLibrary",
    summary: SWAGGER_DICTIONARY.user.library.summary,
    description: SWAGGER_DICTIONARY.user.library.description,
    response: {
      status: 200,
      type: UserLibraryResponseDto,
      description: SWAGGER_DICTIONARY.user.library.response,
      headers: {
        "Accept-Query": {
          schema: { type: "string", enum: ["application/json"] },
        },
        "Cache-Control": { schema: { type: "string", enum: ["no-store"] } },
      },
    },
    errors: [
      { status: 400, description: SWAGGER_DICTIONARY.common.invalidRequest },
      { status: 403, description: SWAGGER_DICTIONARY.common.csrfFailed },
      { status: 404, description: SWAGGER_DICTIONARY.user.library.notFound },
      {
        status: 413,
        description: SWAGGER_DICTIONARY.user.library.bodyTooLarge,
      },
      {
        status: 415,
        description: SWAGGER_DICTIONARY.user.library.unsupportedMediaType,
      },
      { status: 429, description: SWAGGER_DICTIONARY.common.rateLimitExceeded },
      {
        status: 500,
        description: SWAGGER_DICTIONARY.user.library.internalError,
      },
    ],
  })
  readLibrary(
    @Param("id", MongoObjectIdHandler) id: Types.ObjectId,
    @Body() body: UserLibraryBodyDto,
    @Cookies("__Host-accessToken") accessToken: unknown,
  ) {
    return this.userLibraryService.readPage({ id, body, accessToken })
  }
}

export { UserReadController }
