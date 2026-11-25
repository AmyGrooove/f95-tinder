import { REGEX } from "@shared/static/REGEX"
import {
  Body,
  Controller,
  Cookies,
  Get,
  Header,
  HttpCode,
  Param,
  QueryMethod,
  UseInterceptors,
} from "@nestjs/common"
import {
  ApiConsumes,
  ApiBody,
  ApiCookieAuth,
  ApiParam,
  ApiSecurity,
  ApiTags,
} from "@nestjs/swagger"
import { Types } from "mongoose"

import { MongoObjectIdHandler } from "@infrastructure/database/services/mongoObjectIdHandler"
import {
  ApiEndpoint,
  SWAGGER_RESPONSE_HEADERS,
} from "@infrastructure/logger/decorators/ApiEndpoint"
import { SWAGGER_DICTIONARY } from "@endpoints/shared/static/SWAGGER_DICTIONARY"
import { SWAGGER_REQUEST_ERRORS } from "@endpoints/shared/static/SWAGGER_REQUEST_ERRORS"

import {
  CollectionResponseDto,
  CollectionService,
} from "@endpoints/collection/services/collectionService"
import {
  ItemCollectionsBodyDto,
  ItemCollectionsResponseDto,
  CollectionContentService,
} from "@endpoints/collection/services/collectionContentService"
import { CollectionQueryBodyInterceptor } from "@endpoints/collection/services/collectionQueryBodyInterceptor"

@ApiTags(SWAGGER_DICTIONARY.tags.collections)
@Controller("collections")
class CollectionReadController {
  constructor(
    private readonly collectionService: CollectionService,
    private readonly collectionContentService: CollectionContentService,
  ) {}

  @Get(":id")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @ApiParam({
    name: "id",
    type: String,
    description: SWAGGER_DICTIONARY.collection.id,
    schema: { type: "string", pattern: REGEX.MONGO_OBJECT_ID.source },
  })
  @ApiEndpoint({
    operationId: "CollectionController_getById",
    summary: SWAGGER_DICTIONARY.collection.get,
    description: SWAGGER_DICTIONARY.collection.description,
    response: {
      status: 200,
      type: CollectionResponseDto,
      description: SWAGGER_DICTIONARY.collection.response,
      headers: SWAGGER_RESPONSE_HEADERS.noStore,
    },
    errors: [
      { status: 400, description: SWAGGER_DICTIONARY.common.invalidRequest },
      { status: 404, description: SWAGGER_DICTIONARY.collection.notFound },
      { status: 429, description: SWAGGER_DICTIONARY.common.rateLimitExceeded },
    ],
  })
  getById(@Param("id", MongoObjectIdHandler) id: Types.ObjectId) {
    return this.collectionService.getById(id)
  }

  @QueryMethod(":id/items")
  @UseInterceptors(CollectionQueryBodyInterceptor)
  @Header("Accept-Query", "application/json")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @ApiSecurity({})
  @ApiCookieAuth("accessCookie")
  @ApiParam({
    name: "id",
    type: String,
    description: SWAGGER_DICTIONARY.collection.id,
    schema: { type: "string", pattern: REGEX.MONGO_OBJECT_ID.source },
  })
  @ApiBody({
    type: ItemCollectionsBodyDto,
    required: true,
    examples: {
      grouped: {
        summary: "Первые элементы в порядке подборки",
        value: { mode: "grouped", limit: 10 },
      },
    },
  })
  @ApiConsumes("application/json")
  @ApiEndpoint({
    operationId: "CollectionReadController_getItems",
    summary: SWAGGER_DICTIONARY.collection.getItems,
    description: SWAGGER_DICTIONARY.collection.itemsDescription,
    response: {
      status: 200,
      type: ItemCollectionsResponseDto,
      description: SWAGGER_DICTIONARY.collection.itemsResponse,
      headers: SWAGGER_RESPONSE_HEADERS.jsonQuery,
    },
    errors: [
      SWAGGER_REQUEST_ERRORS.bodyTooLarge,
      SWAGGER_REQUEST_ERRORS.unsupportedMediaType,
      { status: 400, description: SWAGGER_DICTIONARY.common.invalidRequest },
      { status: 401, description: SWAGGER_DICTIONARY.common.unauthorized },
      { status: 403, description: SWAGGER_DICTIONARY.common.csrfFailed },
      { status: 404, description: SWAGGER_DICTIONARY.collection.notFound },
      { status: 429, description: SWAGGER_DICTIONARY.common.rateLimitExceeded },
    ],
  })
  getItems(
    @Param("id", MongoObjectIdHandler) id: Types.ObjectId,
    @Body() query: ItemCollectionsBodyDto,
    @Cookies("__Host-accessToken") accessToken?: unknown,
  ) {
    return this.collectionContentService.getItems({ id, query, accessToken })
  }
}

export { CollectionReadController }
