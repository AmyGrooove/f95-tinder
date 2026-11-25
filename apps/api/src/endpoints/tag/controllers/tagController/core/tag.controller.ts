import {
  Body,
  Controller,
  Header,
  HttpCode,
  QueryMethod,
  UseInterceptors,
} from "@nestjs/common"
import { ApiConsumes, ApiBody, ApiTags } from "@nestjs/swagger"

import { SearchBodyInterceptor } from "@endpoints/search/services/searchBodyInterceptor"
import { SWAGGER_DICTIONARY } from "@endpoints/shared/static/SWAGGER_DICTIONARY"
import { SWAGGER_REQUEST_ERRORS } from "@endpoints/shared/static/SWAGGER_REQUEST_ERRORS"
import {
  ApiEndpoint,
  SWAGGER_RESPONSE_HEADERS,
} from "@infrastructure/logger/decorators/ApiEndpoint"

import {
  TagSearchService,
  TagsBodyDto,
  TagsResponseDto,
} from "../../../services/tagSearchService"

@ApiTags(SWAGGER_DICTIONARY.tags.tag)
@Controller("tags")
class TagController {
  constructor(private readonly tagSearchService: TagSearchService) {}

  @QueryMethod()
  @UseInterceptors(SearchBodyInterceptor)
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @Header("Accept-Query", "application/json")
  @ApiConsumes("application/json")
  @ApiBody({
    type: TagsBodyDto,
    required: true,
    examples: {
      firstPage: { summary: "Начало словаря тегов", value: { limit: 20 } },
    },
  })
  @ApiEndpoint({
    operationId: "TagController_search",
    summary: SWAGGER_DICTIONARY.tag.query,
    description: SWAGGER_DICTIONARY.tag.description,
    response: {
      status: 200,
      type: TagsResponseDto,
      description: SWAGGER_DICTIONARY.tag.response,
      headers: SWAGGER_RESPONSE_HEADERS.jsonQuery,
      examples: {
        noMatches: {
          summary: "Подходящих тегов нет",
          value: { items: [], nextCursor: null },
        },
      },
    },
    errors: [
      SWAGGER_REQUEST_ERRORS.bodyTooLarge,
      SWAGGER_REQUEST_ERRORS.unsupportedMediaType,
      { status: 400, description: SWAGGER_DICTIONARY.common.invalidRequest },
      { status: 403, description: SWAGGER_DICTIONARY.common.csrfFailed },
      { status: 429, description: SWAGGER_DICTIONARY.common.rateLimitExceeded },
      { status: 503, description: SWAGGER_DICTIONARY.tag.unavailable },
    ],
  })
  search(@Body() body: TagsBodyDto) {
    return this.tagSearchService.search(body)
  }
}

export { TagController }
