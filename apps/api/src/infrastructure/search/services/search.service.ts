import { Inject, Injectable } from "@nestjs/common"
import type { MeiliSearch } from "meilisearch"

import { SEARCH_CLIENT } from "../static/SEARCH_CLIENT"
import type { ISearchIndexOptions } from "../types/ISearchIndexOptions"
import type { ISearchQueryOptions } from "../types/ISearchQueryOptions"
import type { ISearchResult } from "../types/ISearchResult"
import type { TSearchDocument } from "../types/TSearchDocument"

@Injectable()
class SearchService {
  private readonly indexInitializations = new Map<string, Promise<void>>()

  constructor(
    @Inject(SEARCH_CLIENT) private readonly searchClient: MeiliSearch,
  ) {}

  ensureIndex(name: string, options: ISearchIndexOptions): Promise<void> {
    const existingInitialization = this.indexInitializations.get(name)

    if (existingInitialization !== undefined) {
      return existingInitialization
    }

    const initialization = this.initializeIndex(name, options).finally(() => {
      this.indexInitializations.delete(name)
    })

    this.indexInitializations.set(name, initialization)

    return initialization
  }

  async upsert<TDocument extends TSearchDocument>(
    index: string,
    documents: TDocument[],
    waitForTask = false,
  ): Promise<void> {
    const task = await this.searchClient.index(index).addDocuments(documents)

    if (waitForTask) {
      await this.searchClient.waitForTask(task.taskUid)
    }
  }

  async search<TDocument>(
    index: string,
    query: string,
    options?: ISearchQueryOptions,
  ): Promise<ISearchResult<TDocument>> {
    const result = await this.searchClient.index(index).search<TDocument>(query, options)

    return {
      estimatedTotalHits: result.estimatedTotalHits ?? result.hits.length,
      hits: result.hits,
      limit: result.limit,
      offset: result.offset,
      processingTimeMs: result.processingTimeMs,
      query: result.query,
    }
  }

  async delete(
    index: string,
    id: string,
    waitForTask = false,
  ): Promise<void> {
    const task = await this.searchClient.index(index).deleteDocument(id)

    if (waitForTask) {
      await this.searchClient.waitForTask(task.taskUid)
    }
  }

  async clear(index: string, waitForTask = false): Promise<void> {
    const task = await this.searchClient.index(index).deleteAllDocuments()

    if (waitForTask) {
      await this.searchClient.waitForTask(task.taskUid)
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.searchClient.health()

      return true
    } catch {
      return false
    }
  }

  private async initializeIndex(
    name: string,
    options: ISearchIndexOptions,
  ): Promise<void> {
    try {
      await this.searchClient.getIndex(name)
    } catch {
      const task = await this.searchClient.createIndex(name, {
        primaryKey: options.primaryKey,
      })

      await this.searchClient.waitForTask(task.taskUid)
    }

    const task = await this.searchClient.index(name).updateSettings({
      displayedAttributes: options.displayedAttributes,
      filterableAttributes: options.filterableAttributes,
      rankingRules: options.rankingRules,
      searchableAttributes: options.searchableAttributes,
      sortableAttributes: options.sortableAttributes,
    })

    await this.searchClient.waitForTask(task.taskUid)
  }
}

export { SearchService }
