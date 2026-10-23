import {
  Body,
  Controller,
  Cookies,
  Delete,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
} from "@nestjs/common"
import { ApiCookieAuth, ApiParam, ApiTags } from "@nestjs/swagger"
import { Types } from "mongoose"

import { MongoObjectIdHandler } from "@infrastructure/database/handlers/mongoObjectId.handler"
import { ApiEndpoint } from "@infrastructure/logger/decorators/ApiEndpoint"
import { SWAGGER_DICTIONARY } from "@entities/shared/static/SWAGGER_DICTIONARY"

import { CollectionResponseDto } from "../dto/response/collection.response"
import { CollectionService } from "../services/collection.service"
import { CreateCollectionBodyDto } from "../dto/body/createCollection.body"
import { UpdateCollectionBodyDto } from "../dto/body/updateCollection.body"

@ApiTags(SWAGGER_DICTIONARY.tags.collections)
@Controller("collections")
class CollectionController {
  constructor(private readonly collectionService: CollectionService) {}

  @Post()
  @HttpCode(201)
  @Header("Cache-Control", "no-store")
  @ApiCookieAuth("accessCookie")
  @ApiEndpoint({
    operationId: "CollectionController_create",
    summary: SWAGGER_DICTIONARY.collection.create,
    description: SWAGGER_DICTIONARY.collection.createDescription,
    response: {
      status: 201,
      type: CollectionResponseDto,
      description: SWAGGER_DICTIONARY.collection.response,
    },
    errors: [
      { status: 400, description: SWAGGER_DICTIONARY.common.invalidRequest },
      { status: 401, description: SWAGGER_DICTIONARY.common.unauthorized },
      { status: 403, description: SWAGGER_DICTIONARY.common.csrfFailed },
      { status: 404, description: SWAGGER_DICTIONARY.collection.itemNotFound },
      { status: 429, description: SWAGGER_DICTIONARY.common.rateLimitExceeded },
    ],
  })
  create(
    @Cookies("__Host-accessToken") accessToken: unknown,
    @Body() body: CreateCollectionBodyDto,
  ) {
    return this.collectionService.create(accessToken, body)
  }

  @Patch(":id")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @ApiCookieAuth("accessCookie")
  @ApiParam({
    name: "id",
    type: String,
    schema: { type: "string", pattern: "^[a-fA-F0-9]{24}$" },
  })
  @ApiEndpoint({
    operationId: "CollectionController_update",
    summary: SWAGGER_DICTIONARY.collection.update,
    description: SWAGGER_DICTIONARY.collection.updateDescription,
    response: {
      status: 200,
      type: CollectionResponseDto,
      description: SWAGGER_DICTIONARY.collection.response,
    },
    errors: [
      { status: 400, description: SWAGGER_DICTIONARY.common.invalidRequest },
      { status: 401, description: SWAGGER_DICTIONARY.common.unauthorized },
      { status: 403, description: SWAGGER_DICTIONARY.common.csrfFailed },
      {
        status: 404,
        description: SWAGGER_DICTIONARY.collection.updateNotFound,
      },
      {
        status: 409,
        description: SWAGGER_DICTIONARY.collection.versionConflict,
      },
      { status: 429, description: SWAGGER_DICTIONARY.common.rateLimitExceeded },
    ],
  })
  update(
    @Cookies("__Host-accessToken") accessToken: unknown,
    @Param("id", MongoObjectIdHandler) id: Types.ObjectId,
    @Body() body: UpdateCollectionBodyDto,
  ) {
    return this.collectionService.update(accessToken, { id, body })
  }

  @Delete(":id")
  @HttpCode(204)
  @Header("Cache-Control", "no-store")
  @ApiCookieAuth("accessCookie")
  @ApiParam({
    name: "id",
    type: String,
    schema: { type: "string", pattern: "^[a-fA-F0-9]{24}$" },
  })
  @ApiEndpoint({
    operationId: "CollectionController_remove",
    summary: SWAGGER_DICTIONARY.collection.remove,
    description: SWAGGER_DICTIONARY.collection.removeDescription,
    response: {
      status: 204,
      description: SWAGGER_DICTIONARY.collection.removed,
    },
    errors: [
      { status: 400, description: SWAGGER_DICTIONARY.common.invalidRequest },
      { status: 401, description: SWAGGER_DICTIONARY.common.unauthorized },
      { status: 403, description: SWAGGER_DICTIONARY.common.csrfFailed },
      {
        status: 404,
        description: SWAGGER_DICTIONARY.collection.removeNotFound,
      },
      { status: 429, description: SWAGGER_DICTIONARY.common.rateLimitExceeded },
    ],
  })
  remove(
    @Cookies("__Host-accessToken") accessToken: unknown,
    @Param("id", MongoObjectIdHandler) id: Types.ObjectId,
  ) {
    return this.collectionService.remove(accessToken, id)
  }
}

export { CollectionController }
