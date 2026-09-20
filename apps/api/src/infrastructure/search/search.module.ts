import { Module } from "@nestjs/common"
import { Meilisearch } from "meilisearch"

import { InfrastructureConfigModule } from "@infrastructure/config/config.module"
import { InfrastructureConfigService } from "@infrastructure/config/services/config.service"

import { SearchService } from "./services/search.service"
import { SearchHealthService } from "./services/searchHealth.service"
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
