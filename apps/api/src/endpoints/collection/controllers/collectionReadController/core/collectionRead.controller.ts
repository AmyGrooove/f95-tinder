import { REGEX } from "@shared/static/REGEX"
import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Query,
  QueryMethod,
  UseInterceptors,
} from "@nestjs/common"
import { ApiParam, ApiTags } from "@nestjs/swagger"
import { Types } from "mongoose"

import { MongoObjectIdHandler } from "@infrastructure/database/services/mongoObjectIdHandler"
import { ApiEndpoint } from "@infrastructure/logger/decorators/ApiEndpoint"
import { SWAGGER_DICTIONARY } from "@entities/shared/static/SWAGGER_DICTIONARY"

import { CollectionResponseDto } from "@endpoints/collection/dto/response/collection.response"
import { CollectionFiltersQueryDto } from "@endpoints/collection/dto/query/collectionFilters.query"
import { CollectionFiltersResponseDto } from "@endpoints/collection/dto/response/collectionFilters.response"
import { ItemCollectionsBodyDto } from "@endpoints/collection/dto/body/itemCollections.body"
import { ItemCollectionsResponseDto } from "@endpoints/collection/dto/response/itemCollections.response"
import { CollectionService } from "@endpoints/collection/services/collectionService"
import { CollectionContentService } from "@endpoints/collection/services/collectionContentService"
import { QueryCollectionsBodyDto } from "@endpoints/collection/dto/body/queryCollections.body"
import { QueryCollectionsResponseDto } from "@endpoints/collection/dto/response/queryCollections.response"
import { CollectionQueryBodyInterceptor } from "@endpoints/collection/services/collectionQueryBodyInterceptor"

@ApiTags(SWAGGER_DICTIONARY.tags.collections)
@Controller("collections")
class CollectionReadController {
  constructor(
    private readonly collectionService: CollectionService,
    private readonly collectionContentService: CollectionContentService,
  ) {}

  @QueryMethod()
  @UseInterceptors(CollectionQueryBodyInterceptor)
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @Header("Accept-Query", "application/json")
  @ApiEndpoint({
    operationId: "CollectionReadController_query",
    summary: SWAGGER_DICTIONARY.collection.query,
    description: SWAGGER_DICTIONARY.collection.queryDescription,
    response: {
      status: 200,
      type: QueryCollectionsResponseDto,
      description: SWAGGER_DICTIONARY.collection.queryResponse,
    },
    errors: [
      { status: 400, description: SWAGGER_DICTIONARY.common.invalidRequest },
      { status: 403, description: SWAGGER_DICTIONARY.common.csrfFailed },
      { status: 429, description: SWAGGER_DICTIONARY.common.rateLimitExceeded },
    ],
  })
  query(@Body() body: QueryCollectionsBodyDto) {
    return this.collectionService.query(body)
  }

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

  @Get(":id/filters")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @ApiParam({
    name: "id",
    type: String,
    schema: { type: "string", pattern: REGEX.MONGO_OBJECT_ID.source },
  })
  @ApiEndpoint({
    operationId: "CollectionReadController_getFilters",
    summary: SWAGGER_DICTIONARY.collection.getFilters,
    description: SWAGGER_DICTIONARY.collection.filtersDescription,
    response: {
      status: 200,
      type: CollectionFiltersResponseDto,
      description: SWAGGER_DICTIONARY.collection.filtersResponse,
    },
    errors: [
      { status: 400, description: SWAGGER_DICTIONARY.common.invalidRequest },
      { status: 404, description: SWAGGER_DICTIONARY.collection.notFound },
      { status: 429, description: SWAGGER_DICTIONARY.common.rateLimitExceeded },
    ],
  })
  getFilters(
    @Query() _query: CollectionFiltersQueryDto,
    @Param("id", MongoObjectIdHandler) id: Types.ObjectId,
  ) {
    return this.collectionContentService.getFilters(id)
  }
}

export { CollectionReadController }
