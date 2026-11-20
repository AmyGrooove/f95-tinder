import { Controller, Cookies, Get, Header, Param } from "@nestjs/common"
import { ApiCookieAuth, ApiParam, ApiTags } from "@nestjs/swagger"
import { Types } from "mongoose"

import {
  ItemResponseDto,
  ItemService,
} from "@endpoints/item/services/itemService"
import { SWAGGER_DICTIONARY } from "@endpoints/shared/static/SWAGGER_DICTIONARY"
import {
  ItemUserResponseDto,
  UserItemService,
} from "@endpoints/userItem/services/userItemService"
import { MongoObjectIdHandler } from "@infrastructure/database/services/mongoObjectIdHandler"
import { ApiEndpoint } from "@infrastructure/logger/decorators/ApiEndpoint"
import { REGEX } from "@shared/static/REGEX"

const { common, item, tags } = SWAGGER_DICTIONARY

@ApiTags(tags.items)
@Controller("items")
class ItemController {
  constructor(
    private readonly itemService: ItemService,
    private readonly userItemService: UserItemService,
  ) {}

  @Get(":id")
  @ApiParam({
    name: "id",
    schema: { type: "string", pattern: REGEX.MONGO_OBJECT_ID.source },
  })
  @ApiEndpoint({
    operationId: "ItemController_getById",
    summary: item.get,
    description: item.description,
    response: {
      status: 200,
      description: item.response,
      type: ItemResponseDto,
    },
    errors: [
      { status: 400, description: common.invalidRequest },
      { status: 404, description: item.notFound },
      {
        status: 429,
        description: common.rateLimitExceeded,
        headers: { "Retry-After": { schema: { type: "integer" } } },
      },
      { status: 500, description: item.internalError },
    ],
  })
  getById(@Param("id", MongoObjectIdHandler) id: Types.ObjectId) {
    return this.itemService.getById(id)
  }

  @Get(":id/user")
  @Header("Cache-Control", "no-store")
  @ApiCookieAuth("accessCookie")
  @ApiParam({
    name: "id",
    schema: { type: "string", pattern: REGEX.MONGO_OBJECT_ID.source },
  })
  @ApiEndpoint({
    operationId: "ItemController_getUserEntry",
    summary: item.getUserEntry,
    response: {
      status: 200,
      description: item.userResponse,
      type: ItemUserResponseDto,
      headers: {
        "Cache-Control": { schema: { type: "string", enum: ["no-store"] } },
      },
    },
    errors: [
      { status: 400, description: common.invalidRequest },
      { status: 401, description: common.unauthorized },
      { status: 404, description: item.notFound },
      {
        status: 429,
        description: common.rateLimitExceeded,
        headers: { "Retry-After": { schema: { type: "integer" } } },
      },
      { status: 500, description: item.userInternalError },
    ],
  })
  getUserEntry(
    @Cookies("__Host-accessToken") accessToken: unknown,
    @Param("id", MongoObjectIdHandler) id: Types.ObjectId,
  ) {
    return this.userItemService.readByItemId(accessToken, id)
  }
}

export { ItemController }
