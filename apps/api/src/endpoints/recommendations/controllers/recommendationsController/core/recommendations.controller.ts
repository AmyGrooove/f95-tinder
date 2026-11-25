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
import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import {
  ApiEndpoint,
  createSwaggerErrorExample,
  SWAGGER_RESPONSE_HEADERS,
} from "@infrastructure/logger/decorators/ApiEndpoint"

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
  @ApiBody({
    type: RecommendationsBodyDto,
    required: true,
    examples: {
      firstPage: {
        summary: "Первая страница рекомендаций",
        value: { limit: 10 },
      },
    },
  })
  @ApiEndpoint({
    operationId: "RecommendationsController_readPage",
    summary: recommendations.query,
    description: recommendations.description,
    response: {
      status: 200,
      description: recommendations.response,
      type: RecommendationsResponseDto,
      headers: SWAGGER_RESPONSE_HEADERS.jsonQuery,
      examples: {
        lastPage: {
          summary: "Последняя карточка списка",
          value: {
            items: [
              {
                id: "507f1f77bcf86cd799439011",
                type: "movie",
                title: { ru: "Орбита", en: "Orbit" },
                media: [],
                ratingAverage: 8.4,
                userRating: null,
                userStatus: null,
              },
            ],
            count: 1,
            nextCursor: null,
          },
        },
        exhausted: {
          summary: "Список рекомендаций исчерпан",
          value: { items: [], count: 0, nextCursor: null },
        },
      },
    },
    errors: [
      { status: 400, description: common.invalidRequest },
      { status: 401, description: common.unauthorized },
      { status: 403, description: common.csrfFailed },
      {
        status: 410,
        description: recommendations.cursorExpired,
        examples: {
          expiredCursor: createSwaggerErrorExample(
            410,
            "Истёк курсор списка рекомендаций",
            DICTIONARY.recommendation.cursorExpired,
          ),
        },
      },
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
