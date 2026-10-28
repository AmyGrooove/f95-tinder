import { Inject, Injectable } from "@nestjs/common"
import {
  ErrorStatusCode,
  MeilisearchApiError,
  type Meilisearch,
} from "meilisearch"

import { isNil } from "@shared/functions/checks/isNil"
import { DICTIONARY } from "@shared/static/DICTIONARY"

import { SEARCH_CLIENT } from "../static/SEARCH_CLIENT"
import type { ISearchDocument } from "../types/ISearchDocument"
import type { ISearchIndexOptions } from "../types/ISearchIndexOptions"
import type { ISearchQueryOptions } from "../types/ISearchQueryOptions"
import type { ISearchResult } from "../types/ISearchResult"
import type { IIterateSearchProps } from "../types/IIterateSearchProps"
import type { ISearchMatch } from "../types/ISearchMatch"

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

    if (isNil(initialization)) {
      initialization = this.initializeIndex(name, options).finally(() => {
        this.indexInitializations.delete(name)
      })

      this.indexInitializations.set(name, initialization)
    }

    const taskUid = await initialization

    if (isWaitForTask) {
      await this.waitForTask(taskUid)
    }
  }

  async upsert<TDocument extends ISearchDocument>(
    index: string,
    documents: TDocument[],
    isWaitForTask = false,
  ) {
    const task = await this.searchClient.index(index).addDocuments(documents)

    if (isWaitForTask) {
      await this.waitForTask(task.taskUid)
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
      await this.waitForTask(task.taskUid)
    }
  }

  async *iterateMatches(props: IIterateSearchProps) {
    let offset = 0

    while (true) {
      const ids = await this.readDocumentIds(props.index, {
        offset,
        limit: props.batchSize,
      })

      if (ids.length === 0) {
        return
      }

      const result = await this.search<ISearchMatch>(props.index, props.query, {
        offset: 0,
        limit: ids.length,
        filter: [...(props.filter ?? []), `id IN ${JSON.stringify(ids)}`],
        attributesToRetrieve: ["id"],
        showRankingScore: true,
        matchingStrategy: "last",
      })

      yield result.hits
      offset += ids.length
    }
  }

  async clear(index: string, isWaitForTask = false) {
    const task = await this.searchClient.index(index).deleteAllDocuments()

    if (isWaitForTask) {
      await this.waitForTask(task.taskUid)
    }
  }

  async hasIndex(name: string) {
    try {
      await this.searchClient.getIndex(name)

      return true
    } catch (error) {
      if (
        error instanceof MeilisearchApiError &&
        error.cause?.code === ErrorStatusCode.INDEX_NOT_FOUND
      ) {
        return false
      }

      throw error
    }
  }

  async readDocumentIds(
    index: string,
    options: { offset: number; limit: number },
  ) {
    const result = await this.searchClient
      .index(index)
      .getDocuments<ISearchDocument>({
        fields: ["id"],
        ...options,
      })

    return result.results.map((document) => document.id)
  }

  async deleteMany(index: string, ids: string[]) {
    const task = await this.searchClient.index(index).deleteDocuments(ids)

    await this.waitForTask(task.taskUid)
  }

  private async waitForTask(taskUid: number) {
    const task = await this.searchClient.tasks.waitForTask(taskUid, {
      timeout: 120_000,
    })

    if (task.status !== "succeeded") {
      throw new Error(DICTIONARY.search.taskFailed, { cause: task.error })
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

      await this.searchClient.createIndex(name, {
        primaryKey: "id",
      })
    }

    const task = await this.searchClient.index(name).updateSettings({
      displayedAttributes: options.displayedAttributes,
      filterableAttributes: options.filterableAttributes,
      rankingRules: options.rankingRules,
      searchableAttributes: options.searchableAttributes,
      sortableAttributes: options.sortableAttributes,
      pagination: options.pagination,
      typoTolerance: options.typoTolerance,
    })

    return task.taskUid
  }
}

export { SearchService }
