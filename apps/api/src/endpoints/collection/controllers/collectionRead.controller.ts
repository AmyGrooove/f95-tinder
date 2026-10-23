import {
  Controller,
  Cookies,
  Get,
  Header,
  HttpCode,
  Param,
  Query,
} from "@nestjs/common"
import { ApiParam, ApiSecurity, ApiTags } from "@nestjs/swagger"
import { Types } from "mongoose"

import { MongoObjectIdHandler } from "@infrastructure/database/handlers/mongoObjectId.handler"
import { ApiEndpoint } from "@infrastructure/logger/decorators/ApiEndpoint"
import { SWAGGER_DICTIONARY } from "@entities/shared/static/SWAGGER_DICTIONARY"

import { CollectionResponseDto } from "../dto/response/collection.response"
import { CollectionFiltersQueryDto } from "../dto/query/collectionFilters.query"
import { CollectionFiltersResponseDto } from "../dto/response/collectionFilters.response"
import { CollectionItemsQueryDto } from "../dto/query/collectionItems.query"
import { CollectionItemsResponseDto } from "../dto/response/collectionItems.response"
import { CollectionService } from "../services/collection.service"
import { CollectionContentService } from "../services/collectionContent.service"

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

  @Get(":id/items")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @ApiSecurity({})
  @ApiSecurity("accessCookie")
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
      type: CollectionItemsResponseDto,
      description: SWAGGER_DICTIONARY.collection.itemsResponse,
    },
    errors: [
      { status: 400, description: SWAGGER_DICTIONARY.common.invalidRequest },
      { status: 401, description: SWAGGER_DICTIONARY.common.unauthorized },
      { status: 404, description: SWAGGER_DICTIONARY.collection.notFound },
      { status: 429, description: SWAGGER_DICTIONARY.common.rateLimitExceeded },
    ],
  })
  getItems(
    @Cookies("__Host-accessToken") accessToken: unknown,
    @Param("id", MongoObjectIdHandler) id: Types.ObjectId,
    @Query() query: CollectionItemsQueryDto,
  ) {
    return this.collectionContentService.getItems(accessToken, { id, query })
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
    @Param("id", MongoObjectIdHandler) id: Types.ObjectId,
    @Query() query: CollectionFiltersQueryDto,
  ) {
    return this.collectionContentService.getFilters(id, query)
  }
}

export { CollectionReadController }
