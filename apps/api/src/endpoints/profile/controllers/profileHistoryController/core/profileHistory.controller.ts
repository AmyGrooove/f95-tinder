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
import { ApiBody, ApiConsumes, ApiCookieAuth, ApiParam } from "@nestjs/swagger"
import { Types } from "mongoose"

import {
  ProfileHistoryBodyDto,
  ProfileHistoryResponseDto,
  ProfileHistoryService,
} from "@endpoints/profile/services/profileHistoryService"
import { LibraryQueryRequestInterceptor } from "@endpoints/shared/interceptors/libraryQueryRequestInterceptor"
import { SWAGGER_DICTIONARY } from "@endpoints/shared/static/SWAGGER_DICTIONARY"
import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { SWAGGER_REQUEST_ERRORS } from "@endpoints/shared/static/SWAGGER_REQUEST_ERRORS"
import { MongoObjectIdHandler } from "@infrastructure/database/services/mongoObjectIdHandler"
import {
  ApiEndpoint,
  createSwaggerErrorExample,
  SWAGGER_RESPONSE_HEADERS,
} from "@infrastructure/logger/decorators/ApiEndpoint"
import { REGEX } from "@shared/static/REGEX"

const {
  common,
  tags,
  profile: { history },
  user,
} = SWAGGER_DICTIONARY

@ApiCookieAuth("accessCookie")
@Controller("profile/:userId")
class ProfileHistoryController {
  constructor(private readonly profileHistoryService: ProfileHistoryService) {}

  @QueryMethod("history")
  @UseInterceptors(LibraryQueryRequestInterceptor)
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @Header("Accept-Query", "application/json")
  @ApiConsumes("application/json")
  @ApiParam({
    name: "userId",
    type: String,
    required: true,
    description: history.userId,
    schema: { type: "string", pattern: REGEX.MONGO_OBJECT_ID.source },
  })
  @ApiBody({
    type: ProfileHistoryBodyDto,
    required: true,
    examples: {
      recent: { summary: "Последние события профиля", value: { limit: 10 } },
    },
  })
  @ApiEndpoint({
    operationId: "ProfileHistoryController_readPage",
    summary: history.summary,
    description: history.description,
    tags: [{ name: tags.profileHistory, parent: tags.profile }],
    response: {
      status: 200,
      type: ProfileHistoryResponseDto,
      description: history.response,
      headers: SWAGGER_RESPONSE_HEADERS.jsonQuery,
      examples: {
        statusChange: {
          summary: "Изменение статуса в истории",
          value: {
            items: [
              {
                id: "507f1f77bcf86cd799439011",
                itemId: "507f1f77bcf86cd799439012",
                item: { title: { ru: "Орбита", en: "Orbit" }, poster: null },
                createdAt: "2026-11-26T12:00:00Z",
                type: "statusChanged",
                status: "completed",
              },
            ],
            nextCursor: null,
          },
        },
      },
    },
    errors: [
      SWAGGER_REQUEST_ERRORS.bodyTooLarge,
      SWAGGER_REQUEST_ERRORS.unsupportedMediaType,
      { status: 400, description: common.invalidRequest },
      { status: 401, description: common.unauthorized },
      { status: 403, description: common.csrfFailed },
      {
        status: 404,
        description: user.library.notFound,
        examples: {
          profileNotFound: createSwaggerErrorExample(
            404,
            "Профиль не найден",
            DICTIONARY.user.library.notFound,
          ),
        },
      },
      { status: 429, description: common.rateLimitExceeded },
    ],
  })
  readPage(
    @Cookies("__Host-accessToken") accessToken: unknown,
    @Param("userId", MongoObjectIdHandler) profileUserId: Types.ObjectId,
    @Body() body: ProfileHistoryBodyDto,
  ) {
    return this.profileHistoryService.readPage({
      accessToken,
      profileUserId,
      body,
    })
  }
}

export { ProfileHistoryController }
