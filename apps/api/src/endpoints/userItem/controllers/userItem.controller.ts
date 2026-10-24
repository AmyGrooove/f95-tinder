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
} from "@nestjs/common"
import { ApiCookieAuth, ApiParam, ApiTags } from "@nestjs/swagger"
import { Types } from "mongoose"

import { ApiEndpoint } from "@infrastructure/logger/decorators/ApiEndpoint"
import { SWAGGER_DICTIONARY } from "@entities/shared/static/SWAGGER_DICTIONARY"

import { CreateUserItemBodyDto } from "../dto/body/createUserItem.body"
import { CreateExclusionBodyDto } from "../dto/body/createExclusion.body"
import { UpdateUserItemBodyDto } from "../dto/body/updateUserItem.body"
import { CreateAttemptBodyDto } from "../dto/body/createAttempt.body"
import { UpdateAttemptBodyDto } from "../dto/body/updateAttempt.body"
import { UserItemResponseDto } from "../dto/response/userItem.response"
import { MongoObjectIdHandler } from "@infrastructure/database/handlers/mongoObjectId.handler"
import { UserItemService } from "../services/userItem.service"
import { USER_ITEM_ERRORS } from "../static/USER_ITEM_ERRORS"

@ApiTags(SWAGGER_DICTIONARY.tags.userItems)
@ApiCookieAuth("accessCookie")
@Controller("userItems")
class UserItemController {
  constructor(private readonly userItemService: UserItemService) {}

  @Post()
  @HttpCode(201)
  @ApiEndpoint({
    operationId: "UserItemController_create",
    summary: SWAGGER_DICTIONARY.userItem.create,
    description: SWAGGER_DICTIONARY.userItem.createDescription,
    response: {
      status: 201,
      type: UserItemResponseDto,
      description: SWAGGER_DICTIONARY.userItem.response,
    },
    errors: USER_ITEM_ERRORS,
  })
  @Header("Cache-Control", "no-store")
  create(
    @Cookies("__Host-accessToken") accessToken: unknown,
    @Body() body: CreateUserItemBodyDto,
  ) {
    return this.userItemService.create(accessToken, body)
  }

  @Post("skip")
  @HttpCode(201)
  @ApiEndpoint({
    operationId: "UserItemController_skip",
    summary: SWAGGER_DICTIONARY.userItem.skip,
    description: SWAGGER_DICTIONARY.userItem.skipDescription,
    response: {
      status: 201,
      type: UserItemResponseDto,
      description: SWAGGER_DICTIONARY.userItem.response,
    },
    errors: USER_ITEM_ERRORS,
  })
  @Header("Cache-Control", "no-store")
  skip(
    @Cookies("__Host-accessToken") accessToken: unknown,
    @Body() body: CreateExclusionBodyDto,
  ) {
    return this.userItemService.skip(accessToken, body)
  }

  @Post("block")
  @HttpCode(201)
  @ApiEndpoint({
    operationId: "UserItemController_block",
    summary: SWAGGER_DICTIONARY.userItem.block,
    description: SWAGGER_DICTIONARY.userItem.blockDescription,
    response: {
      status: 201,
      type: UserItemResponseDto,
      description: SWAGGER_DICTIONARY.userItem.response,
    },
    errors: USER_ITEM_ERRORS,
  })
  @Header("Cache-Control", "no-store")
  block(
    @Cookies("__Host-accessToken") accessToken: unknown,
    @Body() body: CreateExclusionBodyDto,
  ) {
    return this.userItemService.block(accessToken, body)
  }

  @Patch(":id")
  @HttpCode(200)
  @ApiParam({
    name: "id",
    type: String,
    schema: { type: "string", pattern: "^[a-fA-F0-9]{24}$" },
  })
  @ApiEndpoint({
    operationId: "UserItemController_update",
    summary: SWAGGER_DICTIONARY.userItem.update,
    description: SWAGGER_DICTIONARY.userItem.partialUpdate,
    response: {
      status: 200,
      type: UserItemResponseDto,
      description: SWAGGER_DICTIONARY.userItem.response,
    },
    errors: USER_ITEM_ERRORS,
  })
  @Header("Cache-Control", "no-store")
  update(
    @Cookies("__Host-accessToken") accessToken: unknown,
    @Param("id", MongoObjectIdHandler) id: Types.ObjectId,
    @Body() body: UpdateUserItemBodyDto,
  ) {
    return this.userItemService.update(accessToken, { id, body })
  }

  @Delete(":id")
  @HttpCode(204)
  @ApiParam({
    name: "id",
    type: String,
    schema: { type: "string", pattern: "^[a-fA-F0-9]{24}$" },
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
  @HttpCode(201)
  @ApiParam({
    name: "id",
    type: String,
    schema: { type: "string", pattern: "^[a-fA-F0-9]{24}$" },
  })
  @ApiEndpoint({
    operationId: "UserItemController_createAttempt",
    summary: SWAGGER_DICTIONARY.userItem.createAttempt,
    description: SWAGGER_DICTIONARY.userItem.createAttemptDescription,
    response: {
      status: 201,
      type: UserItemResponseDto,
      description: SWAGGER_DICTIONARY.userItem.response,
    },
    errors: USER_ITEM_ERRORS,
  })
  @Header("Cache-Control", "no-store")
  createAttempt(
    @Cookies("__Host-accessToken") accessToken: unknown,
    @Param("id", MongoObjectIdHandler) id: Types.ObjectId,
    @Body() body: CreateAttemptBodyDto,
  ) {
    return this.userItemService.createAttempt(accessToken, { id, body })
  }

  @Patch(":id/attempts/:attemptId")
  @HttpCode(200)
  @ApiParam({
    name: "id",
    type: String,
    schema: { type: "string", pattern: "^[a-fA-F0-9]{24}$" },
  })
  @ApiParam({
    name: "attemptId",
    type: String,
    schema: { type: "string", pattern: "^[a-fA-F0-9]{24}$" },
  })
  @ApiEndpoint({
    operationId: "UserItemController_updateAttempt",
    summary: SWAGGER_DICTIONARY.userItem.updateAttempt,
    description: SWAGGER_DICTIONARY.userItem.updateAttemptDescription,
    response: {
      status: 200,
      type: UserItemResponseDto,
      description: SWAGGER_DICTIONARY.userItem.response,
    },
    errors: USER_ITEM_ERRORS,
  })
  @Header("Cache-Control", "no-store")
  updateAttempt(
    @Cookies("__Host-accessToken") accessToken: unknown,
    @Param("id", MongoObjectIdHandler) id: Types.ObjectId,
    @Param("attemptId", MongoObjectIdHandler) attemptId: Types.ObjectId,
    @Body() body: UpdateAttemptBodyDto,
  ) {
    return this.userItemService.updateAttempt(accessToken, {
      id,
      attemptId,
      body,
    })
  }
}

export { UserItemController }
