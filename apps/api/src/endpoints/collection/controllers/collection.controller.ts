import { Controller, Get, Header, HttpCode, Param } from "@nestjs/common"
import { ApiParam, ApiTags } from "@nestjs/swagger"
import { Types } from "mongoose"

import { MongoObjectIdHandler } from "@infrastructure/database/handlers/mongoObjectId.handler"
import { ApiEndpoint } from "@infrastructure/logger/decorators/ApiEndpoint"
import { SWAGGER_DICTIONARY } from "@entities/shared/static/SWAGGER_DICTIONARY"

import { CollectionResponseDto } from "../dto/response/collection.response"
import { CollectionService } from "../services/collection.service"

@ApiTags(SWAGGER_DICTIONARY.tags.collections)
@Controller("collections")
class CollectionController {
  constructor(private readonly collectionService: CollectionService) {}

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
}

export { CollectionController }
