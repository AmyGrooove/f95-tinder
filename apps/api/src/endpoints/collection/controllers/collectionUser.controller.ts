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
import { MongoObjectIdHandler } from "@infrastructure/database/handlers/mongoObjectId.handler"
import { ApiEndpoint } from "@infrastructure/logger/decorators/ApiEndpoint"

import { UserCollectionResponseDto } from "../dto/response/userCollection.response"
import { CollectionUserService } from "../services/collectionUser.service"
import { FavoriteBodyDto } from "../dto/body/favorite.body"
import { RatingBodyDto } from "../dto/body/rating.body"
import { HiddenBodyDto } from "../dto/body/hidden.body"

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
    schema: { type: "string", pattern: "^[a-fA-F0-9]{24}$" },
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

  @Patch(":id/favorite")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @ApiParam({
    name: "id",
    type: String,
    schema: { type: "string", pattern: "^[a-fA-F0-9]{24}$" },
  })
  @ApiEndpoint({
    operationId: "CollectionUserController_updateFavorite",
    summary: SWAGGER_DICTIONARY.collection.updateFavorite,
    description: SWAGGER_DICTIONARY.collection.favoriteDescription,
    response: {
      status: 200,
      type: UserCollectionResponseDto,
      description: SWAGGER_DICTIONARY.collection.userResponse,
    },
    errors: [
      { status: 400, description: SWAGGER_DICTIONARY.common.invalidRequest },
      { status: 401, description: SWAGGER_DICTIONARY.common.unauthorized },
      { status: 403, description: SWAGGER_DICTIONARY.common.csrfFailed },
      { status: 404, description: SWAGGER_DICTIONARY.collection.notFound },
      { status: 429, description: SWAGGER_DICTIONARY.common.rateLimitExceeded },
    ],
  })
  updateFavorite(
    @Cookies("__Host-accessToken") accessToken: unknown,
    @Param("id", MongoObjectIdHandler) id: Types.ObjectId,
    @Body() body: FavoriteBodyDto,
  ) {
    return this.collectionUserService.updateReaction(accessToken, {
      id,
      reaction: { isFavorite: body.isFavorite },
    })
  }

  @Patch(":id/rating")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @ApiParam({
    name: "id",
    type: String,
    schema: { type: "string", pattern: "^[a-fA-F0-9]{24}$" },
  })
  @ApiEndpoint({
    operationId: "CollectionUserController_updateRating",
    summary: SWAGGER_DICTIONARY.collection.updateRating,
    description: SWAGGER_DICTIONARY.collection.ratingDescription,
    response: {
      status: 200,
      type: UserCollectionResponseDto,
      description: SWAGGER_DICTIONARY.collection.userResponse,
    },
    errors: [
      { status: 400, description: SWAGGER_DICTIONARY.common.invalidRequest },
      { status: 401, description: SWAGGER_DICTIONARY.common.unauthorized },
      { status: 403, description: SWAGGER_DICTIONARY.common.csrfFailed },
      { status: 404, description: SWAGGER_DICTIONARY.collection.notFound },
      {
        status: 409,
        description: SWAGGER_DICTIONARY.collection.ownRatingForbidden,
      },
      { status: 429, description: SWAGGER_DICTIONARY.common.rateLimitExceeded },
    ],
  })
  updateRating(
    @Cookies("__Host-accessToken") accessToken: unknown,
    @Param("id", MongoObjectIdHandler) id: Types.ObjectId,
    @Body() body: RatingBodyDto,
  ) {
    return this.collectionUserService.updateReaction(accessToken, {
      id,
      reaction: { rating: body.rating },
    })
  }

  @Patch(":id/hidden")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @ApiParam({
    name: "id",
    type: String,
    schema: { type: "string", pattern: "^[a-fA-F0-9]{24}$" },
  })
  @ApiEndpoint({
    operationId: "CollectionUserController_updateHidden",
    summary: SWAGGER_DICTIONARY.collection.updateHidden,
    description: SWAGGER_DICTIONARY.collection.hiddenDescription,
    response: {
      status: 200,
      type: UserCollectionResponseDto,
      description: SWAGGER_DICTIONARY.collection.userResponse,
    },
    errors: [
      { status: 400, description: SWAGGER_DICTIONARY.common.invalidRequest },
      { status: 401, description: SWAGGER_DICTIONARY.common.unauthorized },
      { status: 403, description: SWAGGER_DICTIONARY.common.csrfFailed },
      { status: 404, description: SWAGGER_DICTIONARY.collection.notFound },
      { status: 429, description: SWAGGER_DICTIONARY.common.rateLimitExceeded },
    ],
  })
  updateHidden(
    @Cookies("__Host-accessToken") accessToken: unknown,
    @Param("id", MongoObjectIdHandler) id: Types.ObjectId,
    @Body() body: HiddenBodyDto,
  ) {
    return this.collectionUserService.updateReaction(accessToken, {
      id,
      reaction: { isHidden: body.isHidden },
    })
  }
}

export { CollectionUserController }
