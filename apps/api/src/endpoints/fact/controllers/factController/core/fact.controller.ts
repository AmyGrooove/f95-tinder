import { Controller, Get, Header, HttpCode, Param } from "@nestjs/common"
import { ApiParam, ApiTags } from "@nestjs/swagger"
import { Types } from "mongoose"

import { MongoObjectIdHandler } from "@infrastructure/database/services/mongoObjectIdHandler"
import {
  ApiEndpoint,
  SWAGGER_RESPONSE_HEADERS,
} from "@infrastructure/logger/decorators/ApiEndpoint"
import { REGEX } from "@shared/static/REGEX"

import {
  FactResponseDto,
  FactService,
} from "@endpoints/fact/services/factService"
import { SWAGGER_DICTIONARY } from "@endpoints/shared/static/SWAGGER_DICTIONARY"

@ApiTags(SWAGGER_DICTIONARY.tags.facts)
@Controller("facts")
class FactController {
  constructor(private readonly factService: FactService) {}

  @Get(":id")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @ApiParam({
    name: "id",
    type: String,
    description: SWAGGER_DICTIONARY.fact.id,
    schema: { type: "string", pattern: REGEX.MONGO_OBJECT_ID.source },
  })
  @ApiEndpoint({
    operationId: "FactController_getById",
    summary: SWAGGER_DICTIONARY.fact.get,
    description: SWAGGER_DICTIONARY.fact.description,
    response: {
      status: 200,
      type: FactResponseDto,
      description: SWAGGER_DICTIONARY.fact.response,
      headers: SWAGGER_RESPONSE_HEADERS.noStore,
      examples: {
        fact: {
          summary: "Факт без указанного автора",
          value: {
            id: "507f1f77bcf86cd799439011",
            text: { ru: "Факт о произведении", en: "A fact about the work" },
            author: null,
          },
        },
      },
    },
    errors: [
      { status: 400, description: SWAGGER_DICTIONARY.common.invalidRequest },
      { status: 404, description: SWAGGER_DICTIONARY.fact.notFound },
      {
        status: 429,
        description: SWAGGER_DICTIONARY.common.rateLimitExceeded,
      },
      { status: 500, description: SWAGGER_DICTIONARY.fact.internalError },
    ],
  })
  getById(@Param("id", MongoObjectIdHandler) id: Types.ObjectId) {
    return this.factService.getById(id)
  }
}

export { FactController }
