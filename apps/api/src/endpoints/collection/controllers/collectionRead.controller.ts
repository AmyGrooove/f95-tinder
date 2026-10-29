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

import { MongoObjectIdHandler } from "@infrastructure/database/handlers/mongoObjectId.handler"
import { ApiEndpoint } from "@infrastructure/logger/decorators/ApiEndpoint"
import { SWAGGER_DICTIONARY } from "@entities/shared/static/SWAGGER_DICTIONARY"

import { CollectionResponseDto } from "../dto/response/collection.response"
import { CollectionFiltersQueryDto } from "../dto/query/collectionFilters.query"
import { CollectionFiltersResponseDto } from "../dto/response/collectionFilters.response"
import { ItemCollectionsBodyDto } from "../dto/body/itemCollections.body"
import { ItemCollectionsResponseDto } from "../dto/response/itemCollections.response"
import { CollectionService } from "../services/collection.service"
import { CollectionContentService } from "../services/collectionContent.service"
import { QueryCollectionsBodyDto } from "../dto/body/queryCollections.body"
import { QueryCollectionsResponseDto } from "../dto/response/queryCollections.response"
import { CollectionQueryBodyInterceptor } from "../interceptors/collectionQueryBody.interceptor"

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
    schema: { type: "string", pattern: "^[a-fA-F0-9]{24}$" },
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
    schema: { type: "string", pattern: "^[a-fA-F0-9]{24}$" },
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
    schema: { type: "string", pattern: "^[a-fA-F0-9]{24}$" },
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
