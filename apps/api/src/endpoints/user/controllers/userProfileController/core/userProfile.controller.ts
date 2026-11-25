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

@ApiTags(tags.profile)
@Controller("users")
class UserProfileController {
  constructor(private readonly userProfileService: UserProfileService) {}

  @Get(":id")
  @ApiParam({
    name: "id",
    type: String,
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
      examples: {
        publicProfile: {
          summary: "Профиль со сводкой библиотеки",
          value: {
            id: "507f1f77bcf86cd799439011",
            username: SWAGGER_DICTIONARY.examples.username,
            displayName: SWAGGER_DICTIONARY.examples.displayName,
            avatarUrl: null,
            createdAt: "2026-11-26T12:00:00Z",
            summary: {
              statusCounts: {
                planned: 2,
                inProgress: 1,
                onHold: 0,
                completed: 3,
                dropped: 0,
              },
              ratingsCount: 3,
              favoritesCount: 1,
            },
          },
        },
      },
    },
    errors: [
      { status: 400, description: common.invalidRequest },
      { status: 404, description: user.library.notFound },
      {
        status: 429,
        description: common.rateLimitExceeded,
      },
      { status: 500, description: user.profile.internalError },
    ],
  })
  readProfile(@Param("id", MongoObjectIdHandler) id: Types.ObjectId) {
    return this.userProfileService.readProfile(id)
  }
}

export { UserProfileController }
