import { REGEX } from "@shared/static/REGEX"
import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  QueryMethod,
  UseInterceptors,
} from "@nestjs/common"
import { ApiParam, ApiTags } from "@nestjs/swagger"
import { Types } from "mongoose"

import { MongoObjectIdHandler } from "@infrastructure/database/services/mongoObjectIdHandler"
import { ApiEndpoint } from "@infrastructure/logger/decorators/ApiEndpoint"
import { SWAGGER_DICTIONARY } from "@endpoints/shared/static/SWAGGER_DICTIONARY"

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
  @ApiParam({
    name: "id",
    type: String,
    schema: { type: "string", pattern: REGEX.MONGO_OBJECT_ID.source },
  })
  @ApiEndpoint({
    operationId: "CollectionReadController_getItems",
    summary: SWAGGER_DICTIONARY.collection.getItems,
    description: SWAGGER_DICTIONARY.collection.itemsDescription,
    response: {
      status: 200,
      type: ItemCollectionsResponseDto,
      description: SWAGGER_DICTIONARY.collection.itemsResponse,
    },
    errors: [
      { status: 400, description: SWAGGER_DICTIONARY.common.invalidRequest },
      { status: 404, description: SWAGGER_DICTIONARY.collection.notFound },
      { status: 429, description: SWAGGER_DICTIONARY.common.rateLimitExceeded },
    ],
  })
  getItems(
    @Param("id", MongoObjectIdHandler) id: Types.ObjectId,
    @Body() query: ItemCollectionsBodyDto,
  ) {
    return this.collectionContentService.getItems({ id, query })
  }
}

export { CollectionReadController }
