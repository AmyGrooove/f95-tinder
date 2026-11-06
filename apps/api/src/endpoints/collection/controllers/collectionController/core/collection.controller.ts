import { REGEX } from "@shared/static/REGEX"
import {
  BadRequestException,
  Body,
  Controller,
  Cookies,
  Delete,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common"
import {
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger"
import { CollectionPosterGuard } from "../guards/collectionPoster.guard"
import { ImageUpload } from "@infrastructure/storage/decorators/ImageUpload"
import { UploadedImage } from "@infrastructure/storage/decorators/UploadedImage"
import type { IStorageUploadResult } from "@infrastructure/storage/services/storageService"
import { Types } from "mongoose"

import { MongoObjectIdHandler } from "@infrastructure/database/services/mongoObjectIdHandler"
import { ApiEndpoint } from "@infrastructure/logger/decorators/ApiEndpoint"
import { SWAGGER_DICTIONARY } from "@endpoints/shared/static/SWAGGER_DICTIONARY"

import {
  CollectionService,
  CreateCollectionBodyDto,
  UpdateCollectionBodyDto,
} from "@endpoints/collection/services/collectionService"

@ApiTags(SWAGGER_DICTIONARY.tags.collections)
@Controller("collections")
class CollectionController {
  constructor(private readonly collectionService: CollectionService) {}

  @Post()
  @HttpCode(201)
  @Header("Cache-Control", "no-store")
  @ApiCookieAuth("accessCookie")
  @ApiEndpoint({
    operationId: "CollectionController_create",
    summary: SWAGGER_DICTIONARY.collection.create,
    description: SWAGGER_DICTIONARY.collection.createDescription,
    response: {
      status: 201,
      schema: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string" } },
      },
      description: "ID созданной подборки",
    },
    errors: [
      { status: 400, description: SWAGGER_DICTIONARY.common.invalidRequest },
      { status: 401, description: SWAGGER_DICTIONARY.common.unauthorized },
      { status: 403, description: SWAGGER_DICTIONARY.common.csrfFailed },
      { status: 404, description: SWAGGER_DICTIONARY.collection.itemNotFound },
      { status: 429, description: SWAGGER_DICTIONARY.common.rateLimitExceeded },
    ],
  })
  create(
    @Cookies("__Host-accessToken") accessToken: unknown,
    @Body() body: CreateCollectionBodyDto,
  ) {
    return this.collectionService.create(accessToken, body)
  }

  @Patch(":id")
  @HttpCode(204)
  @Header("Cache-Control", "no-store")
  @ApiCookieAuth("accessCookie")
  @ApiParam({
    name: "id",
    type: String,
    schema: { type: "string", pattern: REGEX.MONGO_OBJECT_ID.source },
  })
  @ApiEndpoint({
    operationId: "CollectionController_update",
    summary: SWAGGER_DICTIONARY.collection.update,
    description: SWAGGER_DICTIONARY.collection.updateDescription,
    response: {
      status: 204,
      description: "Изменения подборки сохранены",
    },
    errors: [
      { status: 400, description: SWAGGER_DICTIONARY.common.invalidRequest },
      { status: 401, description: SWAGGER_DICTIONARY.common.unauthorized },
      { status: 403, description: SWAGGER_DICTIONARY.common.csrfFailed },
      {
        status: 404,
        description: SWAGGER_DICTIONARY.collection.updateNotFound,
      },
      {
        status: 409,
        description: SWAGGER_DICTIONARY.collection.versionConflict,
      },
      { status: 429, description: SWAGGER_DICTIONARY.common.rateLimitExceeded },
    ],
  })
  async update(
    @Cookies("__Host-accessToken") accessToken: unknown,
    @Param("id", MongoObjectIdHandler) id: Types.ObjectId,
    @Body() body: UpdateCollectionBodyDto,
  ) {
    await this.collectionService.update(accessToken, { id, body })
  }

  @Put(":id/poster")
  @HttpCode(204)
  @Header("Cache-Control", "no-store")
  @ApiCookieAuth("accessCookie")
  @UseGuards(CollectionPosterGuard)
  @ImageUpload("file", {
    path: (request) =>
      "collections/" +
      new Types.ObjectId((request.params as { id: string }).id).toHexString() +
      "/poster",
  })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file"],
      properties: { file: { type: "string", format: "binary" } },
    },
  })
  @ApiParam({
    name: "id",
    type: String,
    schema: { type: "string", pattern: REGEX.MONGO_OBJECT_ID.source },
  })
  @ApiEndpoint({
    operationId: "CollectionController_replacePoster",
    summary: "Загрузить обложку подборки",
    response: { status: 204, description: "Обложка сохранена" },
    errors: [
      { status: 400, description: SWAGGER_DICTIONARY.common.invalidRequest },
      { status: 401, description: SWAGGER_DICTIONARY.common.unauthorized },
      { status: 403, description: SWAGGER_DICTIONARY.common.csrfFailed },
      {
        status: 404,
        description: SWAGGER_DICTIONARY.collection.updateNotFound,
      },
      {
        status: 409,
        description: SWAGGER_DICTIONARY.collection.versionConflict,
      },
      { status: 413, description: "Файл превышает допустимый размер" },
      { status: 429, description: SWAGGER_DICTIONARY.common.rateLimitExceeded },
      { status: 503, description: "Хранилище обложек недоступно" },
    ],
  })
  async replacePoster(
    @Cookies("__Host-accessToken") accessToken: unknown,
    @Param("id", MongoObjectIdHandler) id: Types.ObjectId,
    @UploadedImage("file") file: IStorageUploadResult,
    @Body() fields: Record<string, unknown>,
  ) {
    if (Object.keys(fields).length > 0) {
      throw new BadRequestException(SWAGGER_DICTIONARY.common.invalidRequest)
    }
    await this.collectionService.replacePoster(accessToken, {
      id,
      src: file.publicUrl,
    })
  }

  @Delete(":id")
  @HttpCode(204)
  @Header("Cache-Control", "no-store")
  @ApiCookieAuth("accessCookie")
  @ApiParam({
    name: "id",
    type: String,
    schema: { type: "string", pattern: REGEX.MONGO_OBJECT_ID.source },
  })
  @ApiEndpoint({
    operationId: "CollectionController_remove",
    summary: SWAGGER_DICTIONARY.collection.remove,
    description: SWAGGER_DICTIONARY.collection.removeDescription,
    response: {
      status: 204,
      description: SWAGGER_DICTIONARY.collection.removed,
    },
    errors: [
      { status: 400, description: SWAGGER_DICTIONARY.common.invalidRequest },
      { status: 401, description: SWAGGER_DICTIONARY.common.unauthorized },
      { status: 403, description: SWAGGER_DICTIONARY.common.csrfFailed },
      {
        status: 404,
        description: SWAGGER_DICTIONARY.collection.removeNotFound,
      },
      { status: 429, description: SWAGGER_DICTIONARY.common.rateLimitExceeded },
    ],
  })
  remove(
    @Cookies("__Host-accessToken") accessToken: unknown,
    @Param("id", MongoObjectIdHandler) id: Types.ObjectId,
  ) {
    return this.collectionService.remove(accessToken, id)
  }
}

export { CollectionController }
