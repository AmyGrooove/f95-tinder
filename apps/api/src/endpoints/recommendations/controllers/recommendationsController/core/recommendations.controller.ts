import {
  Body,
  Controller,
  Cookies,
  Header,
  HttpCode,
  QueryMethod,
  UseInterceptors,
} from "@nestjs/common"
import { ApiBody, ApiConsumes, ApiCookieAuth, ApiTags } from "@nestjs/swagger"

import {
  RecommendationsBodyDto,
  RecommendationsHttpService,
  RecommendationsResponseDto,
} from "@endpoints/recommendations/services/recommendationsHttpService"
import { SWAGGER_DICTIONARY } from "@endpoints/shared/static/SWAGGER_DICTIONARY"
import { ApiEndpoint } from "@infrastructure/logger/decorators/ApiEndpoint"

import { RecommendationsBodyInterceptor } from "../services/recommendationsBodyInterceptor"

const { common, recommendations, tags } = SWAGGER_DICTIONARY

@ApiTags(tags.recommendations)
@ApiCookieAuth("accessCookie")
@Controller("recommendations")
class RecommendationsController {
  constructor(
    private readonly recommendationsHttpService: RecommendationsHttpService,
  ) {}

  @QueryMethod()
  @UseInterceptors(RecommendationsBodyInterceptor)
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @Header("Accept-Query", "application/json")
  @ApiConsumes("application/json")
  @ApiBody({ type: RecommendationsBodyDto, required: true })
  @ApiEndpoint({
    operationId: "RecommendationsController_readPage",
    summary: recommendations.query,
    description: recommendations.description,
    response: {
      status: 200,
      description: recommendations.response,
      type: RecommendationsResponseDto,
    },
    errors: [
      { status: 400, description: common.invalidRequest },
      { status: 401, description: common.unauthorized },
      { status: 403, description: common.csrfFailed },
      { status: 410, description: recommendations.cursorExpired },
      { status: 413, description: recommendations.bodyTooLarge },
      { status: 415, description: recommendations.invalidContentType },
      { status: 429, description: common.rateLimitExceeded },
      { status: 500, description: recommendations.internalError },
    ],
  })
  readPage(
    @Cookies("__Host-accessToken") accessToken: unknown,
    @Body() body: RecommendationsBodyDto,
  ) {
    return this.recommendationsHttpService.readPage(accessToken, body)
  }
}

export { RecommendationsController }
