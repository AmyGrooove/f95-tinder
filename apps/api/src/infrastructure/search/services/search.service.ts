import { Inject, Injectable } from "@nestjs/common"
import {
  ErrorStatusCode,
  MeilisearchApiError,
  type Meilisearch,
} from "meilisearch"

import { SEARCH_CLIENT } from "../static/SEARCH_CLIENT"
import type { ISearchDocument } from "../types/ISearchDocument"
import type { ISearchIndexOptions } from "../types/ISearchIndexOptions"
import type { ISearchQueryOptions } from "../types/ISearchQueryOptions"
import type { ISearchResult } from "../types/ISearchResult"

@Injectable()
class SearchService {
  private readonly indexInitializations = new Map<string, Promise<number>>()

  constructor(
    @Inject(SEARCH_CLIENT) private readonly searchClient: Meilisearch,
  ) {}

  async ensureIndex(
    name: string,
    options: ISearchIndexOptions,
    isWaitForTask = false,
  ) {
    let initialization = this.indexInitializations.get(name)

    if (initialization === undefined) {
      initialization = this.initializeIndex(name, options).finally(() => {
        this.indexInitializations.delete(name)
      })

      this.indexInitializations.set(name, initialization)
    }

    const taskUid = await initialization

    if (isWaitForTask) {
      await this.searchClient.tasks.waitForTask(taskUid)
    }
  }

  async upsert<TDocument extends ISearchDocument>(
    index: string,
    documents: TDocument[],
    isWaitForTask = false,
  ) {
    const task = await this.searchClient.index(index).addDocuments(documents)

    if (isWaitForTask) {
      await this.searchClient.tasks.waitForTask(task.taskUid)
    }
  }

  async search<TDocument extends ISearchDocument>(
    index: string,
    query: string,
    options?: ISearchQueryOptions,
  ): Promise<ISearchResult<TDocument>> {
    const result = await this.searchClient
      .index(index)
      .search<TDocument>(query, options)

    return {
      estimatedTotalHits: result.estimatedTotalHits ?? result.hits.length,
      hits: result.hits,
      limit: result.limit,
      offset: result.offset,
      processingTimeMs: result.processingTimeMs,
      query: result.query,
    }
  }

  async delete(index: string, id: string, isWaitForTask = false) {
    const task = await this.searchClient.index(index).deleteDocument(id)

    if (isWaitForTask) {
      await this.searchClient.tasks.waitForTask(task.taskUid)
    }
  }

  async clear(index: string, isWaitForTask = false) {
    const task = await this.searchClient.index(index).deleteAllDocuments()

    if (isWaitForTask) {
      await this.searchClient.tasks.waitForTask(task.taskUid)
    }
  }

  private async initializeIndex(name: string, options: ISearchIndexOptions) {
    try {
      await this.searchClient.getIndex(name)
    } catch (error) {
      if (
        !(error instanceof MeilisearchApiError) ||
        error.cause?.code !== ErrorStatusCode.INDEX_NOT_FOUND
      ) {
        throw error
      }

      await this.searchClient.createIndex(name, { primaryKey: "id" })
    }

    const task = await this.searchClient.index(name).updateSettings({
      displayedAttributes: options.displayedAttributes,
      filterableAttributes: options.filterableAttributes,
      rankingRules: options.rankingRules,
      searchableAttributes: options.searchableAttributes,
      sortableAttributes: options.sortableAttributes,
    })

    return task.taskUid
  }
}

export { SearchService }
