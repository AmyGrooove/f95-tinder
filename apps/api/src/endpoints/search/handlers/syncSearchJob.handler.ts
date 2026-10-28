import { Injectable } from "@nestjs/common"
import { Types } from "mongoose"

import type { IItemSearchIndexEntry } from "@entities/item/types/IItemSearchIndexEntry"
import { EAgeRestriction } from "@entities/item/schemas/EAgeRestriction"
import type { LanguageText } from "@entities/shared/schemas/languageText.schema"
import { ItemRepository } from "@entities/item/services/item.repository"
import { CollectionRepository } from "@entities/collection/services/collection.repository"
import { UserRepository } from "@entities/user/services/user.repository"
import { CacheService } from "@infrastructure/cache/services/cache.service"
import { JobHandler } from "@infrastructure/jobs/decorators/JobHandler"
import type { IJobContext } from "@infrastructure/jobs/types/IJobContext"
import type { IJobHandler } from "@infrastructure/jobs/types/IJobHandler"
import { SearchService } from "@infrastructure/search/services/search.service"
import { isNil } from "@shared/functions/checks/isNil"

import { SEARCH_ITEM_FIELDS } from "../static/SEARCH_ITEM_FIELDS"
import { SEARCH_SETTINGS } from "../static/SEARCH_SETTINGS"
import { SYNC_SEARCH_JOB } from "../static/SYNC_SEARCH_JOB"
import type {
  ISearchSyncSource,
  ISynchronizeSearchProps,
} from "../types/ISearchSyncSource"

@Injectable()
@JobHandler(SYNC_SEARCH_JOB)
class SyncSearchJobHandler implements IJobHandler<null> {
  constructor(
    private readonly searchService: SearchService,
    private readonly cacheService: CacheService,
    private readonly itemRepository: ItemRepository,
    private readonly collectionRepository: CollectionRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async handle(_payload: null, context: IJobContext) {
    const startedAt = Date.now()
    const sources = this.createSources()
    const existing = await Promise.all(
      sources.map((source) => this.searchService.hasIndex(source.index)),
    )
    const checkpoint = existing.every(Boolean)
      ? await this.cacheService.get<number>(SEARCH_SETTINGS.checkpointKey)
      : null

    if (isNil(checkpoint)) {
      await this.cacheService.delete(SEARCH_SETTINGS.checkpointKey)
    }

    const updatedSince = isNil(checkpoint)
      ? undefined
      : new Date(checkpoint - 60_000)

    for (const source of sources) {
      await context.throwIfCancelled()
      await this.searchService.ensureIndex(source.index, source.options, true)
      await this.synchronize({ source, updatedSince, context })
    }

    await context.throwIfCancelled()
    await this.cacheService.set(SEARCH_SETTINGS.checkpointKey, startedAt, 0)
  }

  private async synchronize(props: ISynchronizeSearchProps) {
    const { source, updatedSince, context } = props
    let afterId: Types.ObjectId | undefined

    while (true) {
      await context.throwIfCancelled()

      const batch = await source.readBatch(afterId, updatedSince)

      if (batch.length === 0) {
        break
      }

      const documents = batch.flatMap((entry) =>
        isNil(entry.document) ? [] : [entry.document],
      )
      const deletedIds = batch
        .filter((entry) => isNil(entry.document))
        .map((entry) => String(entry.id))

      if (documents.length > 0) {
        await this.searchService.upsert(source.index, documents, true)
      }

      if (deletedIds.length > 0) {
        await this.searchService.deleteMany(source.index, deletedIds)
      }

      afterId = batch[batch.length - 1].id
    }

    let offset = 0

    while (true) {
      await context.throwIfCancelled()

      const ids = await this.searchService.readDocumentIds(source.index, {
        offset,
        limit: SEARCH_SETTINGS.batchSize,
      })

      if (ids.length === 0) {
        break
      }

      const existingIds = new Set(await source.readExisting(ids))
      const deletedIds = ids.filter((id) => !existingIds.has(id))

      if (deletedIds.length > 0) {
        await this.searchService.deleteMany(source.index, deletedIds)
      }

      offset += ids.length - deletedIds.length
    }
  }

  private createSources(): ISearchSyncSource[] {
    const pagination = { maxTotalHits: SEARCH_SETTINGS.maxTotalHits }
    const typoTolerance = {
      enabled: true,
      minWordSizeForTypos: { oneTypo: 5, twoTypos: 9 },
    }
    const rankingRules = [
      "sort",
      "words",
      "typo",
      "attribute",
      "proximity",
      "exactness",
    ]

    return [
      {
        index: SEARCH_SETTINGS.indexes.items,
        options: {
          searchableAttributes: ["title", "aliases", "description"],
          filterableAttributes: [
            "id",
            "type",
            "tagIds",
            "rating",
            ...Object.values(SEARCH_ITEM_FIELDS).map(
              (field) => `fields.${field}`,
            ),
          ],
          sortableAttributes: [
            "id",
            "sortTitle.ru",
            "sortTitle.en",
            "releaseDate",
            "hasReleaseDate",
            "rating",
            "hasRating",
          ],
          displayedAttributes: ["id", "type", "title", "media"],
          pagination,
          typoTolerance,
          rankingRules,
        },
        readBatch: async (afterId) => {
          const items = await this.itemRepository.readSearchIndexBatch({
            afterId,
            limit: SEARCH_SETTINGS.batchSize,
          })

          return items.map((item) => ({
            id: item._id,
            document: !isNil(item.deletedAt)
              ? null
              : this.mapItemDocument(item),
          }))
        },
        readExisting: async (ids) => {
          const items = await this.itemRepository.read.findMany(
            {
              _id: { $in: ids.map((id) => new Types.ObjectId(id)) },
              deletedAt: null,
            },
            { _id: 1 },
          )

          return items.map((item) => String(item._id))
        },
      },
      {
        index: SEARCH_SETTINGS.indexes.users,
        options: {
          searchableAttributes: ["username", "displayName"],
          filterableAttributes: ["id"],
          sortableAttributes: ["id", "sortUsername", "sortDisplayName"],
          displayedAttributes: ["id", "username", "displayName", "avatarUrl"],
          pagination,
          typoTolerance,
          rankingRules,
        },
        readBatch: async (afterId, updatedSince) => {
          const users = await this.userRepository.read.findMany(
            {
              ...(!isNil(afterId) ? { _id: { $gt: afterId } } : {}),
              ...(!isNil(updatedSince)
                ? { updatedAt: { $gte: updatedSince } }
                : {}),
            },
            { _id: 1, username: 1, displayName: 1, avatarUrl: 1 },
            { sort: { _id: 1 }, limit: SEARCH_SETTINGS.batchSize },
          )

          return users.map((user) => ({
            id: user._id,
            document: {
              id: String(user._id),
              username: user.username,
              displayName: user.displayName,
              avatarUrl: user.avatarUrl,
              sortUsername: user.username.toLowerCase(),
              sortDisplayName: user.displayName.toLowerCase(),
            },
          }))
        },
        readExisting: async (ids) => {
          const users = await this.userRepository.read.findMany(
            { _id: { $in: ids.map((id) => new Types.ObjectId(id)) } },
            { _id: 1 },
          )

          return users.map((user) => String(user._id))
        },
      },
      {
        index: SEARCH_SETTINGS.indexes.collections,
        options: {
          searchableAttributes: ["title", "description"],
          filterableAttributes: ["id", "type", "authorId"],
          sortableAttributes: [
            "id",
            "sortTitle.ru",
            "sortTitle.en",
            "updatedAt",
          ],
          displayedAttributes: ["id", "type", "title", "media", "authorId"],
          pagination,
          typoTolerance,
          rankingRules,
        },
        readBatch: async (afterId, updatedSince) => {
          const collections = await this.collectionRepository.read.findMany(
            {
              ...(!isNil(afterId) ? { _id: { $gt: afterId } } : {}),
              ...(!isNil(updatedSince)
                ? { updatedAt: { $gte: updatedSince } }
                : {}),
            },
            {
              _id: 1,
              type: 1,
              title: 1,
              description: 1,
              media: 1,
              author: 1,
              deletedAt: 1,
              updatedAt: 1,
            },
            { sort: { _id: 1 }, limit: SEARCH_SETTINGS.batchSize },
          )

          return collections.map((collection) => ({
            id: collection._id,
            document: !isNil(collection.deletedAt)
              ? null
              : {
                  id: String(collection._id),
                  type: collection.type,
                  title: { ru: collection.title.ru, en: collection.title.en },
                  description: {
                    ru: collection.description.ru,
                    en: collection.description.en,
                  },
                  media: collection.media.map((media) => ({
                    src: media.src,
                    type: media.type,
                    language: media.language,
                  })),
                  authorId: collection.author?.toString() ?? null,
                  sortTitle: this.mapSortTitle(collection.title),
                  updatedAt: collection.updatedAt.getTime(),
                },
          }))
        },
        readExisting: async (ids) => {
          const collections = await this.collectionRepository.read.findMany(
            {
              _id: { $in: ids.map((id) => new Types.ObjectId(id)) },
              deletedAt: null,
            },
            { _id: 1 },
          )

          return collections.map((collection) => String(collection._id))
        },
      },
    ]
  }

  private mapSortTitle(title: LanguageText) {
    const ru = title.ru?.trim() ?? ""
    const en = title.en?.trim() ?? ""

    return {
      ru: (ru.length > 0 ? ru : en).toLowerCase(),
      en: (en.length > 0 ? en : ru).toLowerCase(),
    }
  }

  private mapItemDocument(item: IItemSearchIndexEntry) {
    return {
      id: String(item._id),
      type: item.type,
      title: { ru: item.title.ru, en: item.title.en },
      aliases: item.aliases,
      description: { ru: item.description.ru, en: item.description.en },
      media: item.media.map((media) => ({
        src: media.src,
        type: media.type,
        language: media.language,
      })),
      tagIds: item.tagIds.map((id) => String(id)),
      rating: item.rating,
      hasRating: isNil(item.rating) ? 0 : 1,
      releaseDate: item.releaseDate?.getTime() ?? null,
      hasReleaseDate: isNil(item.releaseDate) ? 0 : 1,
      sortTitle: this.mapSortTitle(item.title),
      fields: {
        releaseDate: item.releaseDate?.getTime() ?? null,
        ageRestriction: isNil(item.ageRestriction)
          ? null
          : item.ageRestriction === EAgeRestriction.AGE_18_PLUS_PLUS
            ? 18
            : Number(item.ageRestriction),
        duration: item.movie?.duration ?? null,
        episodeCount: item.series?.episodeCount ?? null,
        releasedEpisodeCount: item.series?.releasedEpisodeCount ?? null,
        episodeDuration: item.series?.episodeDuration ?? null,
        nextEpisodeAt: item.series?.nextEpisodeAt?.getTime() ?? null,
        mainStoryDuration: item.game?.mainStoryDuration ?? null,
        fullCompletionDuration: item.game?.fullCompletionDuration ?? null,
      },
    }
  }
}

export { SyncSearchJobHandler }
