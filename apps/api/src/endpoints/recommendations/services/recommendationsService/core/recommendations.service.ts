import { createHash, randomUUID } from "node:crypto"

import { BadRequestException, Injectable } from "@nestjs/common"
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
import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { CacheService } from "@infrastructure/cache/services/cacheService"
import { CursorService } from "@infrastructure/cache/services/cursorService"
import { isNumber } from "@shared/functions/checks/isNumber"
import { isObject } from "@shared/functions/checks/isObject"
import { isString } from "@shared/functions/checks/isString"
import { isUndefined } from "@shared/functions/checks/isUndefined"

import { RecommendationCursorExpiredError } from "../errors/RecommendationCursorExpiredError"
import { createFallbackCursorScope } from "../functions/createFallbackCursorScope"
import { FALLBACK_PAGE_SETTINGS } from "../static/FALLBACK_PAGE_SETTINGS"
import type { IFindRecommendationsProps } from "../types/IFindRecommendationsProps"
import type { TFindRecommendationsResult } from "../types/TFindRecommendationsResult"

interface IFallbackCursorPosition {
  listId: string
  offset: number
}

interface IFallbackSnapshot {
  recommendationVersion: string | null
  itemIds: string[]
}

@Injectable()
class RecommendationsService {
  constructor(
    private readonly candidatesService: RecommendationCandidatesService,
    private readonly fallbackService: FallbackRecommendationsService,
    private readonly itemRepository: ItemRepository,
    private readonly cacheService: CacheService,
    private readonly cursorService: CursorService,
  ) {}

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

    return this.buildFallbackItemIds(context, filter)
  }

  async readFallbackItems(
    accessToken: unknown,
    filter?: IFindRecommendationsProps["filter"],
  ) {
    const itemIds = await this.readFallbackItemIds(accessToken, filter)

    return this.itemRepository.readPosterCardsByIds(itemIds)
  }

  async readFallbackPage(
    accessToken: unknown,
    props: Pick<IFindRecommendationsProps, "cursor" | "filter" | "limit"> = {},
  ): Promise<TFindRecommendationsResult> {
    const {
      cursor,
      filter,
      limit = FALLBACK_PAGE_SETTINGS.defaultPageSize,
    } = props
    const { invalidCursor, invalidLimit } = DICTIONARY.recommendation

    if (limit !== 10 && limit !== 20 && limit !== 50) {
      throw new BadRequestException(invalidLimit)
    }

    const viewer = await this.candidatesService.prepareViewer(accessToken)
    const scope = createFallbackCursorScope({ viewer, limit, filter })
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
            isNumber(value.offset) &&
            Number.isSafeInteger(value.offset) &&
            value.offset > 0 &&
            value.offset % limit === 0,
        })
    const scopeHash = createHash("sha256")
      .update(JSON.stringify(scope))
      .digest("base64url")
    const { namespace, ttlMs } = FALLBACK_PAGE_SETTINGS
    const cacheKey = `${namespace}:${viewer.userId.toHexString()}:${scopeHash}:${listId}`
    const snapshot: IFallbackSnapshot | null = isFirstPage
      ? {
          recommendationVersion: viewer.recommendationVersion,
          itemIds: (
            await this.buildFallbackItemIds(
              await this.candidatesService.prepareContextForViewer(viewer),
              filter,
            )
          ).map((id) => id.toHexString()),
        }
      : await this.cacheService.get<IFallbackSnapshot>(cacheKey)

    if (
      snapshot === null ||
      snapshot.recommendationVersion !== viewer.recommendationVersion
    ) {
      throw new RecommendationCursorExpiredError()
    }

    const { itemIds } = snapshot
    if (!isFirstPage && offset >= itemIds.length) {
      throw new BadRequestException(invalidCursor)
    }

    const nextOffset = offset + limit
    const items = await this.itemRepository.readRecommendationPosterCards({
      ...filter,
      userId: viewer.userId,
      country: viewer.country,
      ids: itemIds
        .slice(offset, nextOffset)
        .map((id) => new Types.ObjectId(id)),
    })

    if (isFirstPage) {
      if (!(await this.candidatesService.checkIsViewerCurrent(viewer))) {
        throw new RecommendationCursorExpiredError()
      }

      await this.cacheService.set(cacheKey, snapshot, ttlMs)

      if (!(await this.candidatesService.checkIsViewerCurrent(viewer))) {
        throw new RecommendationCursorExpiredError()
      }
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

  private async buildFallbackItemIds(
    context: IRecommendationCandidateContext,
    filter?: IFindRecommendationsProps["filter"],
  ) {
    const { types, ...candidateFilter } = filter ?? {}
    const selectedTypes = Object.values(EItemType).filter(
      (type) => types?.includes(type) ?? true,
    )
    const lists = await Promise.all(
      selectedTypes.map((type) =>
        this.fallbackService.readItemIds(context, {
          type,
          filter: candidateFilter,
        }),
      ),
    )
    const items: Types.ObjectId[] = []
    const longestListLength = Math.max(0, ...lists.map((list) => list.length))

    for (let index = 0; index < longestListLength; index += 1) {
      for (const list of lists) {
        const itemId = list[index]

        if (!isUndefined(itemId)) {
          items.push(itemId)
        }
      }
    }

    return items
  }
}

export { RecommendationsService }
