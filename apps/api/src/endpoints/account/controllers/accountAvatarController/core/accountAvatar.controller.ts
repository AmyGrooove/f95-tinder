import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Header,
  HttpCode,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common"
import { ApiBody, ApiConsumes, ApiCookieAuth, ApiTags } from "@nestjs/swagger"

import {
  AccountAvatarResponseDto,
  AccountAvatarService,
} from "@endpoints/account/services/accountAvatarService"
import { SWAGGER_DICTIONARY } from "@endpoints/shared/static/SWAGGER_DICTIONARY"
import { ApiEndpoint } from "@infrastructure/logger/decorators/ApiEndpoint"
import { ImageUpload } from "@infrastructure/storage/decorators/ImageUpload"
import { UploadedImage } from "@infrastructure/storage/decorators/UploadedImage"
import type { IStorageUploadResult } from "@infrastructure/storage/services/storageService"

import { AccountAvatarGuard } from "../guards/accountAvatar.guard"
import type { IAccountAvatarRequest } from "../types/IAccountAvatarRequest"

@ApiTags(SWAGGER_DICTIONARY.tags.account)
@ApiCookieAuth("accessCookie")
@UseGuards(AccountAvatarGuard)
@Controller("account/avatar")
class AccountAvatarController {
  constructor(private readonly avatarService: AccountAvatarService) {}

  @Put()
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @ImageUpload("avatar", {
    path: "avatars",
    resizeWidth: 512,
    resizeHeight: 512,
  })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["avatar"],
      properties: { avatar: { type: "string", format: "binary" } },
    },
  })
  @ApiEndpoint({
    operationId: "AccountAvatarController_replace",
    summary: SWAGGER_DICTIONARY.account.avatar.replace,
    response: {
      status: 200,
      description: SWAGGER_DICTIONARY.account.avatar.replaced,
      type: AccountAvatarResponseDto,
    },
    errors: [
      { status: 400, description: SWAGGER_DICTIONARY.common.invalidRequest },
      { status: 401, description: SWAGGER_DICTIONARY.common.unauthorized },
      { status: 403, description: SWAGGER_DICTIONARY.common.csrfFailed },
      { status: 413, description: SWAGGER_DICTIONARY.account.avatar.tooLarge },
      { status: 429, description: SWAGGER_DICTIONARY.common.rateLimitExceeded },
      {
        status: 503,
        description: SWAGGER_DICTIONARY.account.avatar.storageUnavailable,
      },
    ],
  })
  replace(
    @Req() request: IAccountAvatarRequest,
    @UploadedImage("avatar") avatar: IStorageUploadResult,
    @Body() fields: Record<string, unknown>,
  ) {
    if (Object.keys(fields).length > 0) {
      throw new BadRequestException(SWAGGER_DICTIONARY.common.invalidRequest)
    }

    return this.avatarService.replace(request.avatarOwnerId, avatar)
  }

  @Delete()
  @HttpCode(204)
  @Header("Cache-Control", "no-store")
  @ApiEndpoint({
    operationId: "AccountAvatarController_remove",
    summary: SWAGGER_DICTIONARY.account.avatar.remove,
    response: {
      status: 204,
      description: SWAGGER_DICTIONARY.account.avatar.removed,
    },
    errors: [
      { status: 401, description: SWAGGER_DICTIONARY.common.unauthorized },
      { status: 403, description: SWAGGER_DICTIONARY.common.csrfFailed },
      { status: 429, description: SWAGGER_DICTIONARY.common.rateLimitExceeded },
    ],
  })
  async remove(@Req() request: IAccountAvatarRequest) {
    await this.avatarService.remove(request.avatarOwnerId)
  }
}

export { AccountAvatarController }
