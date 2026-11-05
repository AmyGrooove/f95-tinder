import { Module } from "@nestjs/common"
import { Meilisearch } from "meilisearch"

import { InfrastructureConfigModule } from "@infrastructure/config/config.module"
import { InfrastructureConfigService } from "@infrastructure/config/services/configService"

import { SearchService } from "@infrastructure/search/services/searchService"
import { SearchHealthService } from "@infrastructure/search/services/searchHealthService"
import { SEARCH_CLIENT } from "./static/SEARCH_CLIENT"

@Module({
  imports: [InfrastructureConfigModule],
  providers: [
    {
      provide: SEARCH_CLIENT,
      inject: [InfrastructureConfigService],
      useFactory: (configurationService: InfrastructureConfigService) => {
        const { host, apiKey } = configurationService.search

        return new Meilisearch({
          host,
          apiKey,
        })
      },
    },
    SearchHealthService,
    SearchService,
  ],
  exports: [SearchHealthService, SearchService],
})
class SearchModule {}

export { SearchModule }
