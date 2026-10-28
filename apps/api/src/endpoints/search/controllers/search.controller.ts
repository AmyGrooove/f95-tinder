import {
  Body,
  Controller,
  Header,
  HttpCode,
  QueryMethod,
  UseInterceptors,
} from "@nestjs/common"
import { ApiTags } from "@nestjs/swagger"

import { SWAGGER_DICTIONARY } from "@entities/shared/static/SWAGGER_DICTIONARY"
import { ApiEndpoint } from "@infrastructure/logger/decorators/ApiEndpoint"

import { SearchBodyDto } from "../dto/body/search.body"
import { SearchBodyInterceptor } from "../interceptors/searchBody.interceptor"
import { SearchResponseDto } from "../dto/response/search.response"
import { SiteSearchService } from "../services/siteSearch.service"

@ApiTags(SWAGGER_DICTIONARY.tags.search)
@Controller("search")
class SearchController {
  constructor(private readonly siteSearchService: SiteSearchService) {}

  @QueryMethod()
  @UseInterceptors(SearchBodyInterceptor)
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @Header("Accept-Query", "application/json")
  @ApiEndpoint({
    operationId: "SearchController_search",
    summary: SWAGGER_DICTIONARY.search.query,
    description: SWAGGER_DICTIONARY.search.description,
    response: {
      status: 200,
      type: SearchResponseDto,
      description: SWAGGER_DICTIONARY.search.response,
    },
    errors: [
      { status: 400, description: SWAGGER_DICTIONARY.common.invalidRequest },
      { status: 403, description: SWAGGER_DICTIONARY.common.csrfFailed },
      { status: 429, description: SWAGGER_DICTIONARY.common.rateLimitExceeded },
      { status: 503, description: SWAGGER_DICTIONARY.search.unavailable },
    ],
  })
  search(@Body() body: SearchBodyDto) {
    return this.siteSearchService.search(body)
  }
}

export { SearchController }
