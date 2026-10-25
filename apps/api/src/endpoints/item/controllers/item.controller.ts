import { Controller, Get, Header, HttpCode, Param } from "@nestjs/common"
import { ApiParam, ApiTags } from "@nestjs/swagger"
import { Types } from "mongoose"

import { SWAGGER_DICTIONARY } from "@entities/shared/static/SWAGGER_DICTIONARY"
import { MongoObjectIdHandler } from "@infrastructure/database/handlers/mongoObjectId.handler"
import { ApiEndpoint } from "@infrastructure/logger/decorators/ApiEndpoint"

import { ItemResponseDto } from "../dto/response/item.response"
import { ItemService } from "../services/item.service"

@ApiTags(SWAGGER_DICTIONARY.tags.items)
@Controller("items")
class ItemController {
  constructor(private readonly itemService: ItemService) {}

  @Get(":id")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @ApiParam({
    name: "id",
    type: String,
    schema: { type: "string", pattern: "^[a-fA-F0-9]{24}$" },
  })
  @ApiEndpoint({
    operationId: "ItemController_getById",
    summary: SWAGGER_DICTIONARY.item.get,
    description: SWAGGER_DICTIONARY.item.description,
    response: {
      status: 200,
      type: ItemResponseDto,
      description: SWAGGER_DICTIONARY.item.response,
    },
    errors: [
      { status: 400, description: SWAGGER_DICTIONARY.common.invalidRequest },
      { status: 404, description: SWAGGER_DICTIONARY.item.notFound },
      { status: 429, description: SWAGGER_DICTIONARY.common.rateLimitExceeded },
    ],
  })
  getById(@Param("id", MongoObjectIdHandler) id: Types.ObjectId) {
    return this.itemService.getById(id)
  }
}

export { ItemController }
