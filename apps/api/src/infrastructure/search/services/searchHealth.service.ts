import { Inject, Injectable, type OnApplicationBootstrap } from "@nestjs/common"
import type { Meilisearch } from "meilisearch"

import { SEARCH_CLIENT } from "../static/SEARCH_CLIENT"
import { DICTIONARY } from "@shared/static/DICTIONARY"

@Injectable()
class SearchHealthService implements OnApplicationBootstrap {
  constructor(
    @Inject(SEARCH_CLIENT) private readonly searchClient: Meilisearch,
  ) {}

  async onApplicationBootstrap() {
    const isHealthy = await this.healthCheck()

    if (!isHealthy) {
      throw new Error(DICTIONARY.search.unavailable)
    }
  }

  async healthCheck() {
    try {
      const health = await this.searchClient.health()

      return health.status === "available"
    } catch {
      return false
    }
  }
}

export { SearchHealthService }
