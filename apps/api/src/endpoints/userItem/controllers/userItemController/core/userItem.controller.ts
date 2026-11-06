import { REGEX } from "@shared/static/REGEX"
import {
  Body,
  Controller,
  Cookies,
  Delete,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  QueryMethod,
} from "@nestjs/common"
import { ApiCookieAuth, ApiParam, ApiTags } from "@nestjs/swagger"
import { Types } from "mongoose"

import { ApiEndpoint } from "@infrastructure/logger/decorators/ApiEndpoint"
import { SWAGGER_DICTIONARY } from "@endpoints/shared/static/SWAGGER_DICTIONARY"

import {
  CreateUserItemBodyDto,
  CreateExclusionBodyDto,
  UpdateUserItemBodyDto,
  CreateAttemptBodyDto,
  UpdateAttemptBodyDto,
  UserItemService,
  QueryUserItemsBodyDto,
  UserItemSummaryResponseDto,
} from "@endpoints/userItem/services/userItemService"
import { MongoObjectIdHandler } from "@infrastructure/database/services/mongoObjectIdHandler"
import { USER_ITEM_ERRORS } from "../static/USER_ITEM_ERRORS"

@ApiTags(SWAGGER_DICTIONARY.tags.userItems)
@ApiCookieAuth("accessCookie")
@Controller("userItems")
class UserItemController {
  constructor(private readonly userItemService: UserItemService) {}

  @QueryMethod()
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @Header("Accept-Query", "application/json")
  @ApiEndpoint({
    operationId: "UserItemController_query",
    summary: SWAGGER_DICTIONARY.userItem.query,
    description: SWAGGER_DICTIONARY.userItem.queryDescription,
    response: {
      status: 200,
      type: UserItemSummaryResponseDto,
      isArray: true,
      description: SWAGGER_DICTIONARY.userItem.summaryResponse,
    },
    errors: USER_ITEM_ERRORS.filter(
      (error) => error.status !== 404 && error.status !== 409,
    ),
  })
  query(
    @Cookies("__Host-accessToken") accessToken: unknown,
    @Body() body: QueryUserItemsBodyDto,
  ) {
    return this.userItemService.query(accessToken, body)
  }

  @Post()
  @HttpCode(204)
  @ApiEndpoint({
    operationId: "UserItemController_create",
    summary: SWAGGER_DICTIONARY.userItem.create,
    description: SWAGGER_DICTIONARY.userItem.createDescription,
    response: {
      status: 204,
      description: SWAGGER_DICTIONARY.userItem.response,
    },
    errors: USER_ITEM_ERRORS,
  })
  @Header("Cache-Control", "no-store")
  async create(
    @Cookies("__Host-accessToken") accessToken: unknown,
    @Body() body: CreateUserItemBodyDto,
  ) {
    await this.userItemService.create(accessToken, body)
  }

  @Post("skip")
  @HttpCode(204)
  @ApiEndpoint({
    operationId: "UserItemController_skip",
    summary: SWAGGER_DICTIONARY.userItem.skip,
    description: SWAGGER_DICTIONARY.userItem.skipDescription,
    response: {
      status: 204,
      description: SWAGGER_DICTIONARY.userItem.response,
    },
    errors: USER_ITEM_ERRORS,
  })
  @Header("Cache-Control", "no-store")
  async skip(
    @Cookies("__Host-accessToken") accessToken: unknown,
    @Body() body: CreateExclusionBodyDto,
  ) {
    await this.userItemService.skip(accessToken, body)
  }

  @Post("block")
  @HttpCode(204)
  @ApiEndpoint({
    operationId: "UserItemController_block",
    summary: SWAGGER_DICTIONARY.userItem.block,
    description: SWAGGER_DICTIONARY.userItem.blockDescription,
    response: {
      status: 204,
      description: SWAGGER_DICTIONARY.userItem.response,
    },
    errors: USER_ITEM_ERRORS,
  })
  @Header("Cache-Control", "no-store")
  async block(
    @Cookies("__Host-accessToken") accessToken: unknown,
    @Body() body: CreateExclusionBodyDto,
  ) {
    await this.userItemService.block(accessToken, body)
  }

  @Patch(":id")
  @HttpCode(204)
  @ApiParam({
    name: "id",
    type: String,
    schema: { type: "string", pattern: REGEX.MONGO_OBJECT_ID.source },
  })
  @ApiEndpoint({
    operationId: "UserItemController_update",
    summary: SWAGGER_DICTIONARY.userItem.update,
    description: SWAGGER_DICTIONARY.userItem.partialUpdate,
    response: {
      status: 204,
      description: SWAGGER_DICTIONARY.userItem.response,
    },
    errors: USER_ITEM_ERRORS,
  })
  @Header("Cache-Control", "no-store")
  async update(
    @Cookies("__Host-accessToken") accessToken: unknown,
    @Param("id", MongoObjectIdHandler) id: Types.ObjectId,
    @Body() body: UpdateUserItemBodyDto,
  ) {
    await this.userItemService.update(accessToken, { id, body })
  }

  @Delete(":id")
  @HttpCode(204)
  @ApiParam({
    name: "id",
    type: String,
    schema: { type: "string", pattern: REGEX.MONGO_OBJECT_ID.source },
  })
  @ApiEndpoint({
    operationId: "UserItemController_remove",
    summary: SWAGGER_DICTIONARY.userItem.remove,
    description: SWAGGER_DICTIONARY.userItem.removeDescription,
    response: {
      status: 204,
      description: SWAGGER_DICTIONARY.userItem.removed,
    },
    errors: USER_ITEM_ERRORS,
  })
  @Header("Cache-Control", "no-store")
  remove(
    @Cookies("__Host-accessToken") accessToken: unknown,
    @Param("id", MongoObjectIdHandler) id: Types.ObjectId,
  ) {
    return this.userItemService.remove(accessToken, id)
  }

  @Post(":id/attempts")
  @HttpCode(204)
  @ApiParam({
    name: "id",
    type: String,
    schema: { type: "string", pattern: REGEX.MONGO_OBJECT_ID.source },
  })
  @ApiEndpoint({
    operationId: "UserItemController_createAttempt",
    summary: SWAGGER_DICTIONARY.userItem.createAttempt,
    description: SWAGGER_DICTIONARY.userItem.createAttemptDescription,
    response: {
      status: 204,
      description: SWAGGER_DICTIONARY.userItem.response,
    },
    errors: USER_ITEM_ERRORS,
  })
  @Header("Cache-Control", "no-store")
  async createAttempt(
    @Cookies("__Host-accessToken") accessToken: unknown,
    @Param("id", MongoObjectIdHandler) id: Types.ObjectId,
    @Body() body: CreateAttemptBodyDto,
  ) {
    await this.userItemService.createAttempt(accessToken, { id, body })
  }

  @Patch(":id/attempts/:attemptId")
  @HttpCode(204)
  @ApiParam({
    name: "id",
    type: String,
    schema: { type: "string", pattern: REGEX.MONGO_OBJECT_ID.source },
  })
  @ApiParam({
    name: "attemptId",
    type: String,
    schema: { type: "string", pattern: REGEX.MONGO_OBJECT_ID.source },
  })
  @ApiEndpoint({
    operationId: "UserItemController_updateAttempt",
    summary: SWAGGER_DICTIONARY.userItem.updateAttempt,
    description: SWAGGER_DICTIONARY.userItem.updateAttemptDescription,
    response: {
      status: 204,
      description: SWAGGER_DICTIONARY.userItem.response,
    },
    errors: USER_ITEM_ERRORS,
  })
  @Header("Cache-Control", "no-store")
  async updateAttempt(
    @Cookies("__Host-accessToken") accessToken: unknown,
    @Param("id", MongoObjectIdHandler) id: Types.ObjectId,
    @Param("attemptId", MongoObjectIdHandler) attemptId: Types.ObjectId,
    @Body() body: UpdateAttemptBodyDto,
  ) {
    await this.userItemService.updateAttempt(accessToken, {
      id,
      attemptId,
      body,
    })
  }
}

export { UserItemController }
