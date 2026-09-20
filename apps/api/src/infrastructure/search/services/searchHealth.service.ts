import { Inject, Injectable, type OnApplicationBootstrap } from "@nestjs/common"
import type { MeiliSearch } from "meilisearch"

import { SEARCH_CLIENT } from "../static/SEARCH_CLIENT"

@Injectable()
class SearchHealthService implements OnApplicationBootstrap {
  constructor(
    @Inject(SEARCH_CLIENT) private readonly searchClient: MeiliSearch,
  ) {}

  async onApplicationBootstrap() {
    const isHealthy = await this.healthCheck()

    if (!isHealthy) {
      throw new Error("Meilisearch is unavailable")
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
