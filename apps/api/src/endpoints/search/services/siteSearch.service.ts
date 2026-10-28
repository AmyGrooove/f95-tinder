import { ELanguage } from "@entities/shared/schemas/ELanguage"
import {
  BadRequestException,
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common"
import { isISO8601 } from "class-validator"
import { Types } from "mongoose"

import { ItemRepository } from "@entities/item/services/item.repository"
import { UserRepository } from "@entities/user/services/user.repository"
import { CollectionRepository } from "@entities/collection/services/collection.repository"
import type { Item } from "@entities/item/schemas/item.schema"
import { EItemFieldValueType } from "@entities/item/schemas/EItemFieldValueType"
import { ITEM_FIELD_DEFINITIONS } from "@entities/item/static/ITEM_FIELD_DEFINITIONS"
import type { IRecommendationFilter } from "@entities/item/types/IRecommendationFilter"
import type { MediaSrc } from "@entities/shared/schemas/mediaSrc.schema"
import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { CacheService } from "@infrastructure/cache/services/cache.service"
import { SearchService } from "@infrastructure/search/services/search.service"
import type { ISearchDocument } from "@infrastructure/search/types/ISearchDocument"
import { isNil } from "@shared/functions/checks/isNil"
import { isUndefined } from "@shared/functions/checks/isUndefined"
import { isDate } from "@shared/functions/checks/isDate"
import { isString } from "@shared/functions/checks/isString"
import { isFiniteNumber } from "@shared/functions/checks/isFiniteNumber"

import type { SearchBodyDto } from "../dto/body/search.body"
import type { SearchItemsBodyDto } from "../dto/body/searchOptions.body"
import type { SearchResponseDto } from "../dto/response/search.response"
import { SEARCH_ITEM_FIELDS } from "../static/SEARCH_ITEM_FIELDS"
import type { ISearchGroupProps } from "../types/ISearchGroupProps"
import type { ISearchMatch } from "@infrastructure/search/types/ISearchMatch"
import { SEARCH_SETTINGS } from "../static/SEARCH_SETTINGS"
import type { IFindSearchItemsProps } from "../types/IFindSearchItemsProps"

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
    const offset = (body.page - 1) * body.limit

    if (offset >= SEARCH_SETTINGS.maxTotalHits) {
      throw new BadRequestException(DICTIONARY.search.invalidPage)
    }

    const filter = this.prepareItemFilter(body.items)
    try {
      const checkpoint = await this.cacheService.get<number>(
        SEARCH_SETTINGS.checkpointKey,
      )

      if (isNil(checkpoint)) {
        throw new ServiceUnavailableException(DICTIONARY.search.unavailable)
      }

      const userSort = body.users?.sort
      const userDirection =
        body.users?.direction ??
        (userSort === "username" || userSort === "displayName" ? "asc" : "desc")
      const collectionSort = body.collections?.sort
      const collectionDirection =
        body.collections?.direction ??
        (collectionSort === "title" ? "asc" : "desc")
      const collectionFilter = [
        ...(isUndefined(body.collections?.types)
          ? []
          : [`type IN ${JSON.stringify(body.collections.types)}`]),
        ...(isUndefined(body.collections?.authorIds)
          ? []
          : [
              `authorId IN ${JSON.stringify(body.collections.authorIds.map((id) => id.toLowerCase()))}`,
            ]),
      ]
      const [items, users, collections] = await Promise.all([
        this.findItems({
          body,
          searchFilters: this.createItemFilters(filter),
        }),
        this.searchGroup({
          index: SEARCH_SETTINGS.indexes.users,
          search: body.search,
          filter: [],
          page: body.page,
          limit: body.limit,
          isAscendingRelevance:
            (isUndefined(userSort) || userSort === "relevance") &&
            userDirection === "asc",
          sort:
            userSort === "username"
              ? [`sortUsername:${userDirection}`, "id:asc"]
              : userSort === "displayName"
                ? [`sortDisplayName:${userDirection}`, "id:asc"]
                : undefined,
        }),
        this.searchGroup({
          index: SEARCH_SETTINGS.indexes.collections,
          search: body.search,
          filter: collectionFilter,
          page: body.page,
          limit: body.limit,
          isAscendingRelevance:
            (isUndefined(collectionSort) || collectionSort === "relevance") &&
            collectionDirection === "asc",
          sort:
            collectionSort === "title"
              ? [
                  `sortTitle.${body.collections?.language ?? ELanguage.RUSSIAN}:${collectionDirection}`,
                  "id:asc",
                ]
              : collectionSort === "updatedAt"
                ? [`updatedAt:${collectionDirection}`, "id:asc"]
                : undefined,
        }),
      ])
      const [itemDocuments, userDocuments, collectionDocuments] =
        await Promise.all([
          this.itemRepository.read.findMany(
            {
              _id: { $in: items.hits.map((hit) => new Types.ObjectId(hit.id)) },
              deletedAt: null,
            },
            { _id: 1, type: 1, title: 1, media: 1 },
          ),
          this.userRepository.read.findMany(
            {
              _id: { $in: users.hits.map((hit) => new Types.ObjectId(hit.id)) },
            },
            { _id: 1, username: 1, displayName: 1, avatarUrl: 1 },
          ),
          this.collectionRepository.read.findMany(
            {
              _id: {
                $in: collections.hits.map((hit) => new Types.ObjectId(hit.id)),
              },
              deletedAt: null,
            },
            { _id: 1, type: 1, title: 1, media: 1, author: 1 },
          ),
        ])
      const itemsById = new Map(
        itemDocuments.map((item) => [String(item._id), item]),
      )
      const usersById = new Map(
        userDocuments.map((user) => [String(user._id), user]),
      )
      const collectionsById = new Map(
        collectionDocuments.map((collection) => [
          String(collection._id),
          collection,
        ]),
      )

      return {
        items: {
          hits: items.hits.flatMap((hit) => {
            const item = itemsById.get(hit.id)

            return isUndefined(item) ? [] : [this.mapItem(item)]
          }),
          estimatedTotalHits: items.estimatedTotalHits,
        },
        users: {
          hits: users.hits.flatMap((hit) => {
            const user = usersById.get(hit.id)

            return isUndefined(user)
              ? []
              : [
                  {
                    id: String(user._id),
                    username: user.username,
                    displayName: user.displayName,
                    avatarUrl: user.avatarUrl,
                  },
                ]
          }),
          estimatedTotalHits: users.estimatedTotalHits,
        },
        collections: {
          hits: collections.hits.flatMap((hit) => {
            const collection = collectionsById.get(hit.id)

            return isUndefined(collection)
              ? []
              : [
                  {
                    id: String(collection._id),
                    type: collection.type,
                    title: {
                      [ELanguage.RUSSIAN]: collection.title[ELanguage.RUSSIAN],
                      [ELanguage.ENGLISH]: collection.title[ELanguage.ENGLISH],
                    },
                    media: this.mapMedia(collection.media),
                    authorId: collection.author?.toString() ?? null,
                  },
                ]
          }),
          estimatedTotalHits: collections.estimatedTotalHits,
        },
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error
      }

      throw new ServiceUnavailableException(DICTIONARY.search.unavailable, {
        cause: error,
      })
    }
  }

  private async searchGroup(
    props: ISearchGroupProps,
  ): Promise<{ hits: ISearchDocument[]; estimatedTotalHits: number }> {
    const offset = (props.page - 1) * props.limit

    if (!props.isAscendingRelevance) {
      return this.searchService.search<ISearchDocument>(
        props.index,
        props.search,
        {
          filter: props.filter,
          sort: props.sort,
          offset,
          limit: Math.min(props.limit, SEARCH_SETTINGS.maxTotalHits - offset),
          attributesToRetrieve: ["id"],
          matchingStrategy: "last",
        },
      )
    }

    let ranked: ISearchMatch[] = []
    let total = 0

    for await (const batch of this.searchService.iterateMatches({
      index: props.index,
      query: props.search,
      filter: props.filter,
      batchSize: SEARCH_SETTINGS.batchSize,
    })) {
      if (batch.some((hit) => !isFiniteNumber(hit._rankingScore))) {
        throw new ServiceUnavailableException(DICTIONARY.search.unavailable)
      }

      total += batch.length
      ranked = [...ranked, ...batch]
        .sort((first, second) => {
          const difference = first._rankingScore - second._rankingScore

          return difference !== 0
            ? difference
            : first.id.localeCompare(second.id)
        })
        .slice(0, offset + props.limit)
    }

    return {
      hits: ranked.slice(
        offset,
        Math.min(offset + props.limit, SEARCH_SETTINGS.maxTotalHits),
      ),
      estimatedTotalHits: total,
    }
  }

  private async findItems(props: IFindSearchItemsProps) {
    const { body, searchFilters } = props
    const sort = body.items?.sort

    const direction =
      body.items?.direction ?? (sort === "title" ? "asc" : "desc")
    const sorting =
      sort === "title"
        ? [
            `sortTitle.${body.items?.language ?? ELanguage.RUSSIAN}:${direction}`,
            "id:asc",
          ]
        : sort === "releaseDate"
          ? ["hasReleaseDate:desc", `releaseDate:${direction}`, "id:asc"]
          : sort === "rating"
            ? ["hasRating:desc", `rating:${direction}`, "id:asc"]
            : undefined

    return this.searchGroup({
      index: SEARCH_SETTINGS.indexes.items,
      search: body.search,
      filter: searchFilters,
      sort: sorting,
      page: body.page,
      limit: body.limit,
      isAscendingRelevance:
        (isUndefined(sort) || sort === "relevance") && direction === "asc",
    })
  }

  private createItemFilters(filter: IRecommendationFilter) {
    const expressions: string[] = [
      ...(!isUndefined(filter.ratingMin) || !isUndefined(filter.ratingMax)
        ? ["rating IS NOT NULL"]
        : []),
      ...(isUndefined(filter.types)
        ? []
        : [`type IN ${JSON.stringify(filter.types)}`]),
      ...(filter.tagIds ?? []).map(
        (id) => `tagIds = ${JSON.stringify(String(id))}`,
      ),
      ...(isUndefined(filter.ratingMin)
        ? []
        : [`rating >= ${filter.ratingMin}`]),
      ...(isUndefined(filter.ratingMax)
        ? []
        : [`rating <= ${filter.ratingMax}`]),
    ]

    for (const field of filter.fields ?? []) {
      const attribute = `fields.${SEARCH_ITEM_FIELDS[field.field]}`
      expressions.push(`${attribute} IS NOT NULL`)

      if (!isUndefined(field.min)) {
        expressions.push(
          `${attribute} >= ${isDate(field.min) ? field.min.getTime() : field.min}`,
        )
      }

      if (!isUndefined(field.max)) {
        expressions.push(
          `${attribute} <= ${isDate(field.max) ? field.max.getTime() : field.max}`,
        )
      }
    }

    return expressions
  }

  private prepareItemFilter(
    options?: SearchItemsBodyDto,
  ): IRecommendationFilter {
    const { ratingMin, ratingMax, fields = [] } = options ?? {}

    if (
      (!isUndefined(ratingMin) &&
        !isUndefined(ratingMax) &&
        ratingMin > ratingMax) ||
      new Set(fields.map((field) => field.field)).size !== fields.length
    ) {
      throw new BadRequestException(DICTIONARY.search.invalidFilters)
    }

    return {
      types: options?.types,
      tagIds: options?.tagIds?.map((id) => new Types.ObjectId(id)),
      ratingMin,
      ratingMax,
      fields: fields.map((field) => {
        const definition = ITEM_FIELD_DEFINITIONS[field.field]

        if (
          isUndefined(definition) ||
          (isUndefined(field.min) && isUndefined(field.max))
        ) {
          throw new BadRequestException(DICTIONARY.search.invalidFilters)
        }

        if (definition.valueType === EItemFieldValueType.NUMBER) {
          if (
            (!isUndefined(field.min) && !isFiniteNumber(field.min)) ||
            (!isUndefined(field.max) && !isFiniteNumber(field.max))
          ) {
            throw new BadRequestException(DICTIONARY.search.invalidFilters)
          }

          const min = isFiniteNumber(field.min) ? field.min : undefined
          const max = isFiniteNumber(field.max) ? field.max : undefined

          if (!isUndefined(min) && !isUndefined(max) && min > max) {
            throw new BadRequestException(DICTIONARY.search.invalidFilters)
          }

          return { field: field.field, min, max }
        }

        const min = this.parseDate(field.min)
        const max = this.parseDate(field.max)

        if (!isUndefined(min) && !isUndefined(max) && min > max) {
          throw new BadRequestException(DICTIONARY.search.invalidFilters)
        }

        return { field: field.field, min, max }
      }),
    }
  }

  private parseDate(value: unknown) {
    if (isUndefined(value)) {
      return undefined
    }

    if (
      !isString(value) ||
      !isISO8601(value, { strict: true, strictSeparator: true }) ||
      !(
        /^\d{4}-\d{2}-\d{2}$/.test(value) ||
        /(?:Z|[+-]\d{2}:\d{2})$/.test(value)
      )
    ) {
      throw new BadRequestException(DICTIONARY.search.invalidFilters)
    }

    const date = new Date(value)

    if (!isDate(date)) {
      throw new BadRequestException(DICTIONARY.search.invalidFilters)
    }

    return date
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
