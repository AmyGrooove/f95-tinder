import {
  Body,
  Controller,
  Cookies,
  Header,
  HttpCode,
  QueryMethod,
  UseInterceptors,
} from "@nestjs/common"
import { ApiOperation, ApiTags } from "@nestjs/swagger"

import { SWAGGER_DICTIONARY } from "@endpoints/shared/static/SWAGGER_DICTIONARY"
import { ApiEndpoint } from "@infrastructure/logger/decorators/ApiEndpoint"

import {
  SearchBodyDto,
  SearchResponseDto,
  SiteSearchService,
} from "@endpoints/search/services/siteSearchService"
import { SearchBodyInterceptor } from "@endpoints/search/services/searchBodyInterceptor"

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
      headers: {
        "Accept-Query": {
          schema: { type: "string", enum: ["application/json"] },
        },
        "Cache-Control": { schema: { type: "string", enum: ["no-store"] } },
      },
    },
    errors: [
      { status: 400, description: SWAGGER_DICTIONARY.common.invalidRequest },
      { status: 401, description: SWAGGER_DICTIONARY.search.unauthorized },
      { status: 403, description: SWAGGER_DICTIONARY.common.csrfFailed },
      { status: 429, description: SWAGGER_DICTIONARY.common.rateLimitExceeded },
      { status: 503, description: SWAGGER_DICTIONARY.search.unavailable },
    ],
  })
  @ApiOperation({ security: [{}, { accessCookie: [] }] })
  search(
    @Body() body: SearchBodyDto,
    @Cookies("__Host-accessToken") accessToken: unknown,
  ) {
    return this.siteSearchService.search(body, accessToken)
  }
}

export { SearchController }
