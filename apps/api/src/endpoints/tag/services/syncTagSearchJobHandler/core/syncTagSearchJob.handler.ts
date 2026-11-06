import { Injectable } from "@nestjs/common"
import type { Types } from "mongoose"

import { isUndefined } from "@shared/functions/checks/isUndefined"

import { TagRepository } from "@entities/tag/services/tagRepository"
import { CacheService } from "@infrastructure/cache/services/cacheService"
import { JobHandler } from "@infrastructure/jobs/decorators/JobHandler"
import type { IJobContext } from "@infrastructure/jobs/types/IJobContext"
import type { IJobHandler } from "@infrastructure/jobs/types/IJobHandler"
import { SearchService } from "@infrastructure/search/services/searchService"

import { SYNC_TAG_SEARCH_JOB } from "../../../static/SYNC_TAG_SEARCH_JOB"
import { TAG_SEARCH_SETTINGS } from "../../../static/TAG_SEARCH_SETTINGS"
import type { ITagSearchDocument } from "../../../types/ITagSearchDocument"

@Injectable()
@JobHandler(SYNC_TAG_SEARCH_JOB)
class SyncTagSearchJobHandler implements IJobHandler<null> {
  constructor(
    private readonly searchService: SearchService,
    private readonly cacheService: CacheService,
    private readonly tagRepository: TagRepository,
  ) {}

  async handle(_payload: null, context: IJobContext) {
    const { index, checkpointKey, batchSize, maxTotalHits, ungrouped } =
      TAG_SEARCH_SETTINGS
    const startedAt = Date.now()
    const weekStart = new Date(startedAt)
    weekStart.setUTCHours(0, 0, 0, 0)
    weekStart.setUTCDate(
      weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7),
    )
    const isIndexPresent = await this.searchService.hasIndex(index)
    const checkpoint = await this.cacheService.get<number>(checkpointKey)

    if (
      isIndexPresent &&
      checkpoint !== null &&
      checkpoint >= weekStart.getTime()
    ) {
      return
    }

    await context.throwIfCancelled()

    if (!isIndexPresent && checkpoint !== null) {
      await this.cacheService.delete(checkpointKey)
    }

    await this.searchService.ensureIndex(
      index,
      {
        searchableAttributes: ["name.ru", "name.en"],
        displayedAttributes: ["id", "key", "group", "name"],
        filterableAttributes: ["group"],
        sortableAttributes: ["id"],
        rankingRules: [
          "words",
          "typo",
          "proximity",
          "attribute",
          "exactness",
          "sort",
        ],
        typoTolerance: {
          enabled: true,
          minWordSizeForTypos: { oneTypo: 5, twoTypos: 9 },
        },
        pagination: { maxTotalHits },
      },
      true,
    )

    const currentIds = new Set<string>()
    let afterId: Types.ObjectId | undefined

    while (true) {
      await context.throwIfCancelled()
      const tags = await this.tagRepository.read.findMany(
        isUndefined(afterId) ? {} : { _id: { $gt: afterId } },
        { _id: 1, key: 1, group: 1, name: 1 },
        { sort: { _id: 1 }, limit: batchSize },
      )

      if (tags.length === 0) {
        break
      }

      const documents: ITagSearchDocument[] = tags.map((tag) => ({
        id: String(tag._id),
        key: tag.key,
        group: tag.group ?? ungrouped,
        name: { ru: tag.name?.ru ?? null, en: tag.name?.en ?? null },
      }))

      await this.searchService.upsert(index, documents, true)

      for (const { id } of documents) {
        currentIds.add(id)
      }

      afterId = tags[tags.length - 1]._id
    }

    let offset = 0

    while (true) {
      await context.throwIfCancelled()
      const ids = await this.searchService.readDocumentIds(index, {
        offset,
        limit: batchSize,
      })

      if (ids.length === 0) {
        break
      }

      const deletedIds = ids.filter((id) => !currentIds.has(id))

      if (deletedIds.length > 0) {
        await this.searchService.deleteMany(index, deletedIds)
      }

      offset += ids.length - deletedIds.length
    }

    await context.throwIfCancelled()
    await this.cacheService.set(checkpointKey, startedAt, 0)
  }
}

export { SyncTagSearchJobHandler }
