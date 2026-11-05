import { BadRequestException } from "@nestjs/common"
import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { UpdateCollectionReactionBodyDto } from "../dto/updateCollectionReaction.body"
import { REGEX } from "@shared/static/REGEX"
import {
  Body,
  Controller,
  Cookies,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
} from "@nestjs/common"
import { ApiCookieAuth, ApiParam, ApiTags } from "@nestjs/swagger"
import { Types } from "mongoose"

import { SWAGGER_DICTIONARY } from "@entities/shared/static/SWAGGER_DICTIONARY"
import { MongoObjectIdHandler } from "@infrastructure/database/services/mongoObjectIdHandler"
import { ApiEndpoint } from "@infrastructure/logger/decorators/ApiEndpoint"

import {
  UserCollectionResponseDto,
  CollectionUserService,
} from "@endpoints/collection/services/collectionUserService"

@ApiTags(SWAGGER_DICTIONARY.tags.collections)
@ApiCookieAuth("accessCookie")
@Controller("collections")
class CollectionUserController {
  constructor(private readonly collectionUserService: CollectionUserService) {}

  @Get(":id/user")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @ApiParam({
    name: "id",
    type: String,
    schema: { type: "string", pattern: REGEX.MONGO_OBJECT_ID.source },
  })
  @ApiEndpoint({
    operationId: "CollectionUserController_getUser",
    summary: SWAGGER_DICTIONARY.collection.getUser,
    description: SWAGGER_DICTIONARY.collection.userDescription,
    response: {
      status: 200,
      type: UserCollectionResponseDto,
      description: SWAGGER_DICTIONARY.collection.userResponse,
    },
    errors: [
      { status: 400, description: SWAGGER_DICTIONARY.common.invalidRequest },
      { status: 401, description: SWAGGER_DICTIONARY.common.unauthorized },
      { status: 404, description: SWAGGER_DICTIONARY.collection.notFound },
      { status: 429, description: SWAGGER_DICTIONARY.common.rateLimitExceeded },
    ],
  })
  getUser(
    @Cookies("__Host-accessToken") accessToken: unknown,
    @Param("id", MongoObjectIdHandler) id: Types.ObjectId,
  ) {
    return this.collectionUserService.getUser(accessToken, id)
  }

  @Patch(":id/user")
  @HttpCode(204)
  @Header("Cache-Control", "no-store")
  @ApiParam({
    name: "id",
    type: String,
    schema: { type: "string", pattern: REGEX.MONGO_OBJECT_ID.source },
  })
  @ApiEndpoint({
    operationId: "CollectionUserController_updateReaction",
    summary: "Изменить личную реакцию",
    response: { status: 204, description: "Реакция сохранена" },
    errors: [
      { status: 400, description: SWAGGER_DICTIONARY.common.invalidRequest },
      { status: 401, description: SWAGGER_DICTIONARY.common.unauthorized },
      { status: 403, description: SWAGGER_DICTIONARY.common.csrfFailed },
      { status: 404, description: SWAGGER_DICTIONARY.collection.notFound },
      { status: 409, description: DICTIONARY.collection.ownRatingForbidden },
      { status: 429, description: SWAGGER_DICTIONARY.common.rateLimitExceeded },
    ],
  })
  async updateReaction(
    @Cookies("__Host-accessToken") accessToken: unknown,
    @Param("id", MongoObjectIdHandler) id: Types.ObjectId,
    @Body() reaction: UpdateCollectionReactionBodyDto,
  ) {
    if (
      reaction?.isFavorite === undefined &&
      reaction?.rating === undefined &&
      reaction?.isHidden === undefined
    ) {
      throw new BadRequestException(SWAGGER_DICTIONARY.common.invalidRequest)
    }

    await this.collectionUserService.updateReaction(accessToken, {
      id,
      reaction,
    })
  }
}

export { CollectionUserController }
