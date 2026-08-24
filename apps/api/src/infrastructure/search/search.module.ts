import { Module } from "@nestjs/common"
import { MeiliSearch } from "meilisearch"

import { InfrastructureConfigModule } from "@infrastructure/config/config.module"
import { InfrastructureConfigService } from "@infrastructure/config/services/config.service"

import { SearchService } from "./services/search.service"
import { SEARCH_CLIENT } from "./static/SEARCH_CLIENT"

@Module({
  imports: [InfrastructureConfigModule],
  providers: [
    {
      provide: SEARCH_CLIENT,
      inject: [InfrastructureConfigService],
      useFactory: (configurationService: InfrastructureConfigService) => {
        const search = configurationService.search
        const host = search.host?.trim()
        const apiKey = search.apiKey?.trim()

        if (!host || !apiKey) {
          throw new Error(
            "MEILISEARCH_URL and MEILISEARCH_ACCESS_SECRET must be configured",
          )
        }

        let searchHost: URL

        try {
          searchHost = new URL(host)
        } catch {
          throw new Error("MEILISEARCH_URL must be a valid HTTP(S) URL")
        }

        if (
          searchHost.protocol !== "http:" &&
          searchHost.protocol !== "https:"
        ) {
          throw new Error("MEILISEARCH_URL must use HTTP or HTTPS")
        }

        return new MeiliSearch({
          host: searchHost.toString(),
          apiKey,
        })
      },
    },
    SearchService,
  ],
  exports: [SEARCH_CLIENT, SearchService],
})
class SearchModule {}

export { SearchModule }
