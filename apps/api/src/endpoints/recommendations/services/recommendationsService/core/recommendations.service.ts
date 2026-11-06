import { Injectable } from "@nestjs/common"
import type { Types } from "mongoose"

import { FallbackRecommendationsService } from "@endpoints/recommendations/services/fallbackRecommendationsService"
import { RecommendationCandidatesService } from "@endpoints/recommendations/services/recommendationCandidatesService"
import type { IReadRecommendationCandidatesProps } from "@endpoints/recommendations/services/recommendationCandidatesService"
import { EItemType } from "@entities/item/schemas/EItemType"
import { ItemRepository } from "@entities/item/services/itemRepository"
import { isUndefined } from "@shared/functions/checks/isUndefined"

import type { IFindRecommendationsProps } from "../types/IFindRecommendationsProps"

@Injectable()
class RecommendationsService {
  constructor(
    private readonly candidatesService: RecommendationCandidatesService,
    private readonly fallbackService: FallbackRecommendationsService,
    private readonly itemRepository: ItemRepository,
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

  async readFallbackItems(
    accessToken: unknown,
    filter?: IFindRecommendationsProps["filter"],
  ) {
    const itemIds = await this.readFallbackItemIds(accessToken, filter)

    return this.itemRepository.readPosterCardsByIds(itemIds)
  }
}

export { RecommendationsService }
