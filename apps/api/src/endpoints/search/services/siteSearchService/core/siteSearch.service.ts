import { createHash } from "node:crypto"

import {
  BadRequestException,
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common"
import { Types } from "mongoose"

import { CollectionRepository } from "@entities/collection/services/collectionRepository"
import type { Item } from "@entities/item/schemas/item.schema"
import { ItemRepository } from "@entities/item/services/itemRepository"
import { ELanguage } from "@entities/shared/schemas/ELanguage"
import type { MediaSrc } from "@entities/shared/schemas/mediaSrc.schema"
import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { UserRepository } from "@entities/user/services/userRepository"
import { SEARCH_SETTINGS } from "@endpoints/search/static/SEARCH_SETTINGS"
import { CacheService } from "@infrastructure/cache/services/cacheService"
import type { IValueFilter } from "@infrastructure/database/types/IValueFilter"
import { SearchService } from "@infrastructure/search/services/searchService"
import type {
  ISearchDocument,
  ISearchMatch,
} from "@infrastructure/search/services/searchService"
import { isArray } from "@shared/functions/checks/isArray"
import { isFiniteNumber } from "@shared/functions/checks/isFiniteNumber"
import { isNil } from "@shared/functions/checks/isNil"

import type { SearchBodyDto } from "../dto/search.body"
import type { SearchResponseDto } from "../dto/search.response"
import { SEARCH_GROUPS } from "../static/SEARCH_GROUPS"
import type { ISearchGroupProps } from "../types/ISearchGroupProps"
import type { TSearchGroup } from "../types/TSearchGroup"

@Injectable()
class SiteSearchService {
  constructor(
    private readonly searchService: SearchService,
    private readonly cacheService: CacheService,
    private readonly itemRepository: ItemRepository,
    private readonly userRepository: UserRepository,
    private readonly collectionRepository: CollectionRepository,
  ) {}

  async search(body: SearchBodyDto): Promise<SearchResponseDto> {
    const options = this.prepareGroups(body)
    const included = [
      ...(body.types?.allOf ?? []),
      ...(body.types?.anyOf ?? []),
    ]
    const selected = SEARCH_GROUPS.filter(
      (group) =>
        (included.length === 0 || included.includes(group)) &&
        !(body.types?.noneOf ?? []).includes(group),
    )
    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify([
          body.search,
          body.limit,
          selected.map((group) => [group, options[group]]),
        ]),
      )
      .digest("base64url")
    const offsets = this.readOffsets({
      cursor: body.cursor,
      fingerprint,
      selected,
      limit: body.limit,
    })
    const active = selected.flatMap((group, index) => {
      const offset = offsets[index]

      return isNil(offset) || options[group].isImpossible === true
        ? []
        : [{ group, offset, props: options[group] }]
    })

    if (active.length === 0) {
      return { items: [], collections: [], users: [], nextCursor: null }
    }

    try {
      const checkpoint = await this.cacheService.get<number>(
        SEARCH_SETTINGS.checkpointKey,
      )

      if (isNil(checkpoint)) {
        throw new ServiceUnavailableException(DICTIONARY.search.unavailable)
      }

      const pages = new Map(
        await Promise.all(
          active.map(async ({ group, offset, props }) => {
            const hits = await this.searchGroup({ body, group, offset, props })

            return [
              group,
              {
                ids: hits.slice(0, body.limit).map((hit) => hit.id),
                nextOffset:
                  hits.length > body.limit ? offset + body.limit : null,
              },
            ] as const
          }),
        ),
      )
      const nextOffsets = selected.map(
        (group) => pages.get(group)?.nextOffset ?? null,
      )
      const nextCursor = nextOffsets.some((offset) => offset !== null)
        ? Buffer.from(JSON.stringify([1, fingerprint, nextOffsets])).toString(
            "base64url",
          )
        : null
      const [items, collections, users] = await Promise.all([
        this.loadItems(pages.get("items")?.ids ?? []),
        this.loadCollections(pages.get("collections")?.ids ?? []),
        this.loadUsers(pages.get("users")?.ids ?? []),
      ])

      return { items, collections, users, nextCursor }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error
      }

      throw new ServiceUnavailableException(DICTIONARY.search.unavailable, {
        cause: error,
      })
    }
  }

  private readOffsets({
    cursor,
    fingerprint,
    selected,
    limit,
  }: {
    cursor: string | undefined
    fingerprint: string
    selected: TSearchGroup[]
    limit: number
  }): (number | null)[] {
    if (isNil(cursor)) {
      return selected.map(() => 0)
    }

    try {
      const buffer = Buffer.from(cursor, "base64url")

      if (buffer.toString("base64url") === cursor) {
        const payload: unknown = JSON.parse(buffer.toString("utf8"))

        if (isArray(payload) && payload.length === 3) {
          const [version, hash, offsets] = payload

          if (
            version === 1 &&
            hash === fingerprint &&
            isArray(offsets) &&
            offsets.length === selected.length &&
            offsets.some((offset) => offset !== null) &&
            offsets.every(
              (offset): offset is number | null =>
                offset === null ||
                (isFiniteNumber(offset) &&
                  offset % limit === 0 &&
                  offset > 0 &&
                  offset < SEARCH_SETTINGS.maxTotalHits),
            )
          ) {
            return offsets
          }
        }
      }
    } catch (error) {
      throw new BadRequestException(DICTIONARY.search.invalidCursor, {
        cause: error,
      })
    }

    throw new BadRequestException(DICTIONARY.search.invalidCursor)
  }

  private prepareGroups(
    body: SearchBodyDto,
  ): Record<TSearchGroup, ISearchGroupProps> {
    const itemSort = body.items?.sort
    const itemDirection =
      itemSort?.direction ?? (itemSort?.type === "title" ? "asc" : "desc")
    const collectionSort = body.collections?.sort
    const collectionDirection =
      collectionSort?.direction ??
      (collectionSort?.type === "title" ? "asc" : "desc")
    const userSort = body.users?.sort
    const userDirection =
      userSort?.direction ?? (userSort?.type === "displayName" ? "asc" : "desc")
    const collectionTypes = body.collections?.types
    const authorIds = body.collections?.authorIds

    return {
      items: {
        filter: this.createItemFilters(body.items),
        isAscendingRelevance:
          (itemSort?.type ?? "relevance") === "relevance" &&
          itemDirection === "asc",
        sort:
          itemSort?.type === "title"
            ? [
                `sortTitle.${itemSort.language ?? ELanguage.RUSSIAN}:${itemDirection}`,
                "id:asc",
              ]
            : itemSort?.type === "releaseDate"
              ? [
                  "hasReleaseDate:desc",
                  `releaseDate:${itemDirection}`,
                  "id:asc",
                ]
              : itemSort?.type === "rating"
                ? ["hasRating:desc", `rating:${itemDirection}`, "id:asc"]
                : undefined,
      },
      collections: {
        isImpossible:
          (collectionTypes?.allOf?.length ?? 0) > 1 ||
          (authorIds?.allOf?.length ?? 0) > 1,
        filter: [
          ...this.createValueFilters("type", collectionTypes),
          ...this.createValueFilters("authorId", authorIds),
        ],
        isAscendingRelevance:
          (collectionSort?.type ?? "relevance") === "relevance" &&
          collectionDirection === "asc",
        sort:
          collectionSort?.type === "title"
            ? [
                `sortTitle.${collectionSort.language ?? ELanguage.RUSSIAN}:${collectionDirection}`,
                "id:asc",
              ]
            : collectionSort?.type === "updatedAt"
              ? [`updatedAt:${collectionDirection}`, "id:asc"]
              : undefined,
      },
      users: {
        filter: [],
        isAscendingRelevance:
          (userSort?.type ?? "relevance") === "relevance" &&
          userDirection === "asc",
        sort:
          userSort?.type === "displayName"
            ? [`sortDisplayName:${userDirection}`, "id:asc"]
            : undefined,
      },
    }
  }

  private createItemFilters(items: SearchBodyDto["items"]) {
    const { min, max } = items?.rating ?? {}

    if (
      (!isNil(items?.rating) && isNil(min) && isNil(max)) ||
      (!isNil(min) && !isNil(max) && min > max)
    ) {
      throw new BadRequestException(DICTIONARY.search.invalidFilters)
    }

    return [
      ...(isNil(items?.types)
        ? []
        : [`type IN ${JSON.stringify([...items.types].sort())}`]),
      ...this.createValueFilters("tagIds", items?.tags),
      ...(!isNil(min) || !isNil(max) ? ["rating IS NOT NULL"] : []),
      ...(isNil(min) ? [] : [`rating >= ${min}`]),
      ...(isNil(max) ? [] : [`rating <= ${max}`]),
    ]
  }

  private createValueFilters(attribute: string, filter?: IValueFilter<string>) {
    const normalize = (values: readonly string[]) =>
      values.map((value) => value.toLowerCase()).sort()

    return [
      ...normalize(filter?.allOf ?? []).map(
        (value) => `${attribute} = ${JSON.stringify(value)}`,
      ),
      ...(isNil(filter?.anyOf)
        ? []
        : [`${attribute} IN ${JSON.stringify(normalize(filter.anyOf))}`]),
      ...(isNil(filter?.noneOf)
        ? []
        : [`${attribute} NOT IN ${JSON.stringify(normalize(filter.noneOf))}`]),
    ]
  }

  private async searchGroup({
    body,
    group,
    offset,
    props,
  }: {
    body: SearchBodyDto
    group: TSearchGroup
    offset: number
    props: ISearchGroupProps
  }) {
    const index = SEARCH_SETTINGS.indexes[group]
    const limit = Math.min(
      body.limit + 1,
      SEARCH_SETTINGS.maxTotalHits - offset,
    )

    if (!props.isAscendingRelevance) {
      const result = await this.searchService.search<ISearchDocument>(
        index,
        body.search,
        {
          filter: props.filter,
          sort: props.sort,
          offset,
          limit,
          attributesToRetrieve: ["id"],
          matchingStrategy: "last",
        },
      )

      return result.hits
    }

    let ranked: ISearchMatch[] = []

    for await (const batch of this.searchService.iterateMatches({
      index,
      query: body.search,
      filter: props.filter,
      batchSize: SEARCH_SETTINGS.batchSize,
    })) {
      if (batch.some((hit) => !isFiniteNumber(hit._rankingScore))) {
        throw new ServiceUnavailableException(DICTIONARY.search.unavailable)
      }

      ranked = [...ranked, ...batch]
        .sort((first, second) => {
          const difference = first._rankingScore - second._rankingScore

          return difference !== 0
            ? difference
            : first.id.localeCompare(second.id)
        })
        .slice(0, offset + limit)
    }

    return ranked.slice(offset)
  }

  private async loadItems(ids: string[]): Promise<SearchResponseDto["items"]> {
    if (ids.length === 0) {
      return []
    }

    const documents = await this.itemRepository.read.findMany(
      {
        _id: { $in: ids.map((id) => new Types.ObjectId(id)) },
        deletedAt: null,
      },
      { _id: 1, type: 1, title: 1, media: 1 },
    )

    return this.orderCards(ids, documents).map((item) => this.mapItem(item))
  }

  private async loadCollections(
    ids: string[],
  ): Promise<SearchResponseDto["collections"]> {
    if (ids.length === 0) {
      return []
    }

    const documents = await this.collectionRepository.read.findMany(
      {
        _id: { $in: ids.map((id) => new Types.ObjectId(id)) },
        deletedAt: null,
      },
      { _id: 1, type: 1, title: 1, media: 1 },
    )

    return this.orderCards(ids, documents).map((collection) => ({
      id: String(collection._id),
      type: collection.type,
      title: {
        [ELanguage.RUSSIAN]: collection.title[ELanguage.RUSSIAN],
        [ELanguage.ENGLISH]: collection.title[ELanguage.ENGLISH],
      },
      media: this.mapMedia(collection.media),
    }))
  }

  private async loadUsers(ids: string[]): Promise<SearchResponseDto["users"]> {
    if (ids.length === 0) {
      return []
    }

    const documents = await this.userRepository.read.findMany(
      { _id: { $in: ids.map((id) => new Types.ObjectId(id)) } },
      { _id: 1, username: 1, displayName: 1, avatarUrl: 1 },
    )

    return this.orderCards(ids, documents).map((user) => ({
      id: String(user._id),
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    }))
  }

  private orderCards<T extends { _id: Types.ObjectId }>(
    ids: string[],
    documents: T[],
  ) {
    const byId = new Map(
      documents.map((document) => [String(document._id), document]),
    )

    return ids.flatMap((id) => {
      const document = byId.get(id)

      return isNil(document) ? [] : [document]
    })
  }

  private mapItem(item: Pick<Item, "_id" | "type" | "title" | "media">) {
    return {
      id: String(item._id),
      type: item.type,
      title: {
        [ELanguage.RUSSIAN]: item.title[ELanguage.RUSSIAN],
        [ELanguage.ENGLISH]: item.title[ELanguage.ENGLISH],
      },
      media: this.mapMedia(item.media),
    }
  }

  private mapMedia(media: MediaSrc[]) {
    return media.map((entry) => ({
      src: entry.src,
      language: entry.language,
      type: entry.type,
    }))
  }
}

export { SiteSearchService }
