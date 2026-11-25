import { Controller, Get, Header, HttpCode } from "@nestjs/common"
import { ApiTags } from "@nestjs/swagger"

import {
  HomeFeedResponseDto,
  HomeFeedService,
} from "@endpoints/home/services/homeFeedService"
import { SWAGGER_DICTIONARY } from "@endpoints/shared/static/SWAGGER_DICTIONARY"
import {
  ApiEndpoint,
  SWAGGER_RESPONSE_HEADERS,
} from "@infrastructure/logger/decorators/ApiEndpoint"

@ApiTags(SWAGGER_DICTIONARY.tags.home)
@Controller("home")
class HomeController {
  constructor(private readonly homeFeedService: HomeFeedService) {}

  @Get("feed")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @ApiEndpoint({
    operationId: "HomeController_getFeed",
    summary: SWAGGER_DICTIONARY.home.getFeed,
    description: SWAGGER_DICTIONARY.home.feedDescription,
    response: {
      status: 200,
      type: HomeFeedResponseDto,
      description: SWAGGER_DICTIONARY.home.feedResponse,
      headers: SWAGGER_RESPONSE_HEADERS.noStore,
      examples: {
        dailyFeed: {
          summary: "Блоки дневной ленты",
          value: {
            date: "2026-11-26",
            blocks: [
              { type: "fact", id: "507f1f77bcf86cd799439011" },
              { type: "collection", id: "507f1f77bcf86cd799439012" },
            ],
          },
        },
      },
    },
    errors: [
      { status: 429, description: SWAGGER_DICTIONARY.common.rateLimitExceeded },
      { status: 500, description: SWAGGER_DICTIONARY.home.feedInternalError },
    ],
  })
  getFeed() {
    return this.homeFeedService.getFeed()
  }
}

export { HomeController }
