import { Controller, Get, Param } from "@nestjs/common"
import { ApiParam, ApiTags } from "@nestjs/swagger"
import { Types } from "mongoose"

import { SWAGGER_DICTIONARY } from "@endpoints/shared/static/SWAGGER_DICTIONARY"
import {
  UserProfileResponseDto,
  UserProfileService,
} from "@endpoints/user/services/userProfileService"
import { MongoObjectIdHandler } from "@infrastructure/database/services/mongoObjectIdHandler"
import { ApiEndpoint } from "@infrastructure/logger/decorators/ApiEndpoint"
import { REGEX } from "@shared/static/REGEX"

const { common, tags, user } = SWAGGER_DICTIONARY

@ApiTags(tags.users)
@Controller("users")
class UserProfileController {
  constructor(private readonly userProfileService: UserProfileService) {}

  @Get(":id")
  @ApiParam({
    name: "id",
    description: user.profile.ownerId,
    schema: { type: "string", pattern: REGEX.MONGO_OBJECT_ID.source },
  })
  @ApiEndpoint({
    operationId: "UserProfileController_readProfile",
    summary: user.profile.summary,
    description: user.profile.description,
    response: {
      status: 200,
      type: UserProfileResponseDto,
      description: user.profile.response,
    },
    errors: [
      { status: 400, description: common.invalidRequest },
      { status: 404, description: user.library.notFound },
      {
        status: 429,
        description: common.rateLimitExceeded,
        headers: { "Retry-After": { schema: { type: "integer" } } },
      },
      { status: 500, description: user.profile.internalError },
    ],
  })
  readProfile(@Param("id", MongoObjectIdHandler) id: Types.ObjectId) {
    return this.userProfileService.readProfile(id)
  }
}

export { UserProfileController }
