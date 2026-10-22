import {
  Controller,
  Cookies,
  Get,
  Header,
  HttpCode,
  Param,
} from "@nestjs/common"
import { ApiCookieAuth, ApiParam, ApiTags } from "@nestjs/swagger"
import { Types } from "mongoose"

import { SWAGGER_DICTIONARY } from "@entities/shared/static/SWAGGER_DICTIONARY"
import { MongoObjectIdHandler } from "@infrastructure/database/handlers/mongoObjectId.handler"
import { ApiEndpoint } from "@infrastructure/logger/decorators/ApiEndpoint"

import { UserCollectionResponseDto } from "../dto/response/userCollection.response"
import { CollectionUserService } from "../services/collectionUser.service"

@ApiTags(SWAGGER_DICTIONARY.tags.collections)
@ApiCookieAuth("accessCookie")
@Controller("collections")
class CollectionUserController {
  constructor(private readonly collectionUserService: CollectionUserService) {}

  @Get(":id/user")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @ApiParam({
    name: "id",
    type: String,
    schema: { type: "string", pattern: "^[a-fA-F0-9]{24}$" },
  })
  @ApiEndpoint({
    operationId: "CollectionUserController_getUser",
    summary: SWAGGER_DICTIONARY.collection.getUser,
    description: SWAGGER_DICTIONARY.collection.userDescription,
    response: {
      status: 200,
      type: UserCollectionResponseDto,
      description: SWAGGER_DICTIONARY.collection.userResponse,
    },
    errors: [
      { status: 400, description: SWAGGER_DICTIONARY.common.invalidRequest },
      { status: 401, description: SWAGGER_DICTIONARY.common.unauthorized },
      { status: 404, description: SWAGGER_DICTIONARY.collection.notFound },
      { status: 429, description: SWAGGER_DICTIONARY.common.rateLimitExceeded },
    ],
  })
  getUser(
    @Cookies("__Host-accessToken") accessToken: unknown,
    @Param("id", MongoObjectIdHandler) id: Types.ObjectId,
  ) {
    return this.collectionUserService.getUser(accessToken, id)
  }
}

export { CollectionUserController }
