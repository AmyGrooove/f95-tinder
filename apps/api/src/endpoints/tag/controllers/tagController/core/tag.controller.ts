import {
  Body,
  Controller,
  Header,
  HttpCode,
  QueryMethod,
  UseInterceptors,
} from "@nestjs/common"
import { ApiTags } from "@nestjs/swagger"

import { SearchBodyInterceptor } from "@endpoints/search/services/searchBodyInterceptor"
import { SWAGGER_DICTIONARY } from "@endpoints/shared/static/SWAGGER_DICTIONARY"
import { ApiEndpoint } from "@infrastructure/logger/decorators/ApiEndpoint"

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
  @ApiEndpoint({
    operationId: "TagController_search",
    summary: SWAGGER_DICTIONARY.tag.query,
    description: SWAGGER_DICTIONARY.tag.description,
    response: {
      status: 200,
      type: TagsResponseDto,
      description: SWAGGER_DICTIONARY.tag.response,
    },
    errors: [
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
