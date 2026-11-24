import { createHash, randomUUID } from "node:crypto"

import { BadRequestException, Inject, Injectable, Logger } from "@nestjs/common"
import { isUUID } from "class-validator"
import { Types } from "mongoose"

import { FallbackRecommendationsService } from "@endpoints/recommendations/services/fallbackRecommendationsService"
import { RecommendationCandidatesService } from "@endpoints/recommendations/services/recommendationCandidatesService"
import type {
  IReadRecommendationCandidatesProps,
  IRecommendationCandidateContext,
} from "@endpoints/recommendations/services/recommendationCandidatesService"
import { EItemType } from "@entities/item/schemas/EItemType"
import { ItemRepository } from "@entities/item/services/itemRepository"
import type { IReadEligibleRecommendationItemsProps } from "@entities/item/services/itemRepository"
import { RecommendationModelRepository } from "@entities/recommendationModel/services/recommendationModelRepository"
import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { CacheService } from "@infrastructure/cache/services/cacheService"
import { CursorService } from "@infrastructure/cache/services/cursorService"
import { isNil } from "@shared/functions/checks/isNil"
import { isInt } from "@shared/functions/checks/isInt"
import { isNonNegativeSafe } from "@shared/functions/checks/isNonNegativeSafe"
import { isObject } from "@shared/functions/checks/isObject"
import { isString } from "@shared/functions/checks/isString"
import { isUndefined } from "@shared/functions/checks/isUndefined"

import { RecommendationCursorExpiredError } from "../static/errors/RecommendationCursorExpiredError"
import { createFallbackCursorScope } from "../functions/createFallbackCursorScope"
import { decodeRecommendationModel } from "../functions/decodeRecommendationModel"
import { FALLBACK_PAGE_SETTINGS } from "../static/FALLBACK_PAGE_SETTINGS"
import { InvalidRecommendationModelError } from "../static/errors/InvalidRecommendationModelError"
import type { IFallbackCursorPosition } from "../types/IFallbackCursorPosition"
import type { IFallbackSnapshot } from "../types/IFallbackSnapshot"
import type {
  IFindRecommendationsProps,
  TReadRecommendationFeedPageProps,
} from "../types/IFindRecommendationsProps"
import type { TReadRecommendationFeedSources } from "../types/IRecommendationFeedSources"
import type { IRecommendationModel } from "../types/IRecommendationModel"
import type { TFindRecommendationsResult } from "../types/TFindRecommendationsResult"

@Injectable()
class RecommendationsService {
  @Inject(RecommendationModelRepository)
  private readonly recommendationModelRepository: RecommendationModelRepository

  constructor(
    private readonly candidatesService: RecommendationCandidatesService,
    private readonly fallbackService: FallbackRecommendationsService,
    private readonly itemRepository: ItemRepository,
    private readonly cacheService: CacheService,
    private readonly cursorService: CursorService,
  ) {}

  async loadLatestModel(
    options: { isInvalidModelIgnored?: boolean } = {},
  ): Promise<IRecommendationModel | null> {
    const { isInvalidModelIgnored = false } = options

    const document = await this.recommendationModelRepository.readLatest()
    if (document === null) {
      return null
    }

    try {
      return decodeRecommendationModel(document)
    } catch (error) {
      if (
        !isInvalidModelIgnored ||
        !(error instanceof InvalidRecommendationModelError)
      ) {
        throw error
      }

      Logger.warn(error, RecommendationsService.name)
      return null
    }
  }

  async readPopularItemIds(
    accessToken: unknown,
    props: IReadRecommendationCandidatesProps,
  ) {
    const context = await this.candidatesService.prepareContext(accessToken)

    return this.candidatesService.readPopularItemIds(context, props)
  }

  async readNewItemIds(
    accessToken: unknown,
    props: IReadRecommendationCandidatesProps,
  ) {
    const context = await this.candidatesService.prepareContext(accessToken)

    return this.candidatesService.readNewItemIds(context, props)
  }

  async readFallbackItemIds(
    accessToken: unknown,
    filter?: IFindRecommendationsProps["filter"],
  ) {
    const context = await this.candidatesService.prepareContext(accessToken)

    return this.buildItemIds(context, filter)
  }

  async readFallbackItems(
    accessToken: unknown,
    filter?: IFindRecommendationsProps["filter"],
  ) {
    const itemIds = await this.readFallbackItemIds(accessToken, filter)

    return this.itemRepository.readPosterCardsByIds(itemIds)
  }

  readFallbackPage(
    accessToken: unknown,
    props: Pick<IFindRecommendationsProps, "cursor" | "filter" | "limit"> = {},
  ): Promise<TFindRecommendationsResult> {
    return this.readSnapshotPage(accessToken, props, {
      namespace: FALLBACK_PAGE_SETTINGS.namespace,
      readCards: (query) =>
        this.itemRepository.readRecommendationPosterCards(query),
    })
  }

  readFeedPage(
    accessToken: unknown,
    props: TReadRecommendationFeedPageProps,
    readSources: TReadRecommendationFeedSources,
  ) {
    return this.readSnapshotPage(accessToken, props, {
      namespace: FALLBACK_PAGE_SETTINGS.feedNamespace,
      readCards: (query) => this.itemRepository.readRecommendationCards(query),
      readSources,
    })
  }

  private async readSnapshotPage<TCard>(
    accessToken: unknown,
    props: TReadRecommendationFeedPageProps,
    options: {
      namespace: string
      readCards: (
        props: IReadEligibleRecommendationItemsProps,
      ) => Promise<TCard[]>
      readSources?: TReadRecommendationFeedSources
    },
  ) {
    const { namespace, readCards, readSources } = options
    const {
      cursor,
      filter,
      limit = FALLBACK_PAGE_SETTINGS.defaultPageSize,
      excludeItemIds,
    } = props
    const { invalidCursor, invalidLimit } = DICTIONARY.recommendation

    if (limit !== 10 && limit !== 20 && limit !== 50) {
      throw new BadRequestException(invalidLimit)
    }

    const viewer = await this.candidatesService.prepareViewer(accessToken)
    const scope = createFallbackCursorScope({
      viewer,
      limit,
      filter,
      namespace,
    })
    const isFirstPage = isUndefined(cursor)
    const { listId, offset } = isFirstPage
      ? { listId: randomUUID(), offset: 0 }
      : this.cursorService.read({
          cursor,
          scope,
          invalidCursorMessage: invalidCursor,
          isPosition: (value): value is IFallbackCursorPosition =>
            isObject(value) &&
            "listId" in value &&
            isString(value.listId) &&
            isUUID(value.listId, "4") &&
            "offset" in value &&
            isInt(value.offset) &&
            isNonNegativeSafe(value.offset) &&
            value.offset > 0 &&
            value.offset % limit === 0,
        })
    const scopeHash = createHash("sha256")
      .update(JSON.stringify(scope))
      .digest("base64url")
    const { ttl } = FALLBACK_PAGE_SETTINGS
    const cacheKey = `${namespace}:${viewer.userId.toHexString()}:${scopeHash}:${listId}`
    const snapshot: IFallbackSnapshot | null = isFirstPage
      ? {
          itemIds: (
            await this.buildItemIds(
              await this.candidatesService.prepareContextForViewer(viewer),
              filter,
              { readSources, excludeItemIds },
            )
          ).map((id) => id.toHexString()),
        }
      : await this.cacheService.get<IFallbackSnapshot>(cacheKey)

    if (isNil(snapshot)) {
      throw new RecommendationCursorExpiredError()
    }

    const { itemIds } = snapshot
    if (!isFirstPage && offset >= itemIds.length) {
      throw new BadRequestException(invalidCursor)
    }

    const nextOffset = offset + limit
    const items = await readCards({
      ...filter,
      userId: viewer.userId,
      country: viewer.country,
      ids: itemIds
        .slice(offset, nextOffset)
        .map((id) => new Types.ObjectId(id)),
    })

    if (isFirstPage) {
      await this.cacheService.set(cacheKey, snapshot, ttl)
    }

    const nextCursor =
      nextOffset < itemIds.length
        ? this.cursorService.create({
            scope,
            position: { listId, offset: nextOffset },
          })
        : null

    return { items, count: items.length, nextCursor }
  }

  private async buildItemIds(
    context: IRecommendationCandidateContext,
    filter?: IFindRecommendationsProps["filter"],
    options: {
      readSources?: TReadRecommendationFeedSources
      excludeItemIds?: readonly Types.ObjectId[]
    } = {},
  ) {
    const { readSources, excludeItemIds = [] } = options

    const { types, ...candidateFilter } = filter ?? {}
    const selectedTypes = Object.values(EItemType).filter(
      (type) => types?.includes(type) ?? true,
    )
    const { plannedIds, personalByType } =
      (await readSources?.(context, selectedTypes)) ?? {}
    const lists = await Promise.all(
      selectedTypes.map((type) =>
        this.fallbackService.readItemIds(
          context,
          { type, filter: candidateFilter },
          { plannedIds, personal: personalByType?.get(type) },
        ),
      ),
    )
    const excludedIds = new Set(excludeItemIds.map((id) => id.toHexString()))
    const items: Types.ObjectId[] = []
    const longestListLength = Math.max(0, ...lists.map((list) => list.length))

    for (let index = 0; index < longestListLength; index += 1) {
      for (const list of lists) {
        const itemId = list[index]

        if (!isUndefined(itemId) && !excludedIds.has(itemId.toHexString())) {
          items.push(itemId)
        }
      }
    }

    return items
  }
}

export { RecommendationsService }
