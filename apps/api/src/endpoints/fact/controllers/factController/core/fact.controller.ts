import { Controller, Get, Header, HttpCode, Param } from "@nestjs/common"
import { ApiParam, ApiTags } from "@nestjs/swagger"
import { Types } from "mongoose"

import { MongoObjectIdHandler } from "@infrastructure/database/services/mongoObjectIdHandler"
import { ApiEndpoint } from "@infrastructure/logger/decorators/ApiEndpoint"
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
    schema: { type: "string", pattern: REGEX.MONGO_OBJECT_ID.source },
  })
  @ApiEndpoint({
    operationId: "FactController_getById",
    summary: SWAGGER_DICTIONARY.fact.get,
    response: {
      status: 200,
      type: FactResponseDto,
      description: SWAGGER_DICTIONARY.fact.response,
      headers: {
        "Cache-Control": { schema: { type: "string", enum: ["no-store"] } },
      },
    },
    errors: [
      { status: 400, description: SWAGGER_DICTIONARY.common.invalidRequest },
      { status: 404, description: SWAGGER_DICTIONARY.fact.notFound },
      {
        status: 429,
        description: SWAGGER_DICTIONARY.common.rateLimitExceeded,
        headers: {
          "Retry-After": {
            description: SWAGGER_DICTIONARY.fact.retryAfter,
            schema: { type: "integer" },
          },
        },
      },
      { status: 500, description: SWAGGER_DICTIONARY.fact.internalError },
    ],
  })
  getById(@Param("id", MongoObjectIdHandler) id: Types.ObjectId) {
    return this.factService.getById(id)
  }
}

export { FactController }
