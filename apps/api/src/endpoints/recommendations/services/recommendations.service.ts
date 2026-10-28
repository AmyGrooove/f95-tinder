import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common"

import { CollectionRepository } from "@entities/collection/services/collection.repository"
import { ECollectionBlockType } from "@entities/collection/schemas/ECollectionBlockType"
import { ItemRepository } from "@entities/item/services/item.repository"
import { EItemFieldValueType } from "@entities/item/schemas/EItemFieldValueType"
import { ITEM_FIELD_DEFINITIONS } from "@entities/item/static/ITEM_FIELD_DEFINITIONS"
import { UserItemRepository } from "@entities/userItem/services/userItem.repository"
import { UserTasteProfileRepository } from "@entities/userTasteProfile/services/userTasteProfile.repository"
import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { normalizePagination } from "@shared/functions/pagination/normalizePagination"
import { createPaginatedResult } from "@shared/functions/pagination/createPaginatedResult"
import { isUndefined } from "@shared/functions/checks/isUndefined"
import { isNil } from "@shared/functions/checks/isNil"
import { isDate } from "@shared/functions/checks/isDate"
import { isFiniteNumber } from "@shared/functions/checks/isFiniteNumber"

import type { IFindRecommendationsProps } from "../types/IFindRecommendationsProps"
import type { IReadRecommendationsProps } from "@entities/item/types/IReadRecommendationsProps"

@Injectable()
class RecommendationsService {
  constructor(
    private readonly itemRepository: ItemRepository,
    private readonly collectionRepository: CollectionRepository,
    private readonly userItemRepository: UserItemRepository,
    private readonly userTasteProfileRepository: UserTasteProfileRepository,
  ) {}

  async find(props: IFindRecommendationsProps) {
    const { page, limit } = normalizePagination(props.pagination, 20)

    if (!Number.isSafeInteger((page - 1) * limit)) {
      throw new BadRequestException(
        DICTIONARY.recommendations.invalidPagination,
      )
    }

    const context = await this.createRankingContext(props)
    const result = await this.itemRepository.readRecommendations({
      ...context,
      page,
      limit,
    })

    return createPaginatedResult(result.items, result.total, page, limit)
  }

  private async createRankingContext(
    props: IFindRecommendationsProps,
  ): Promise<Omit<IReadRecommendationsProps, "page" | "limit">> {
    this.validateConditions(props)

    const collectionGroupIds = await this.getCollectionGroupIds(props.filter)
    const [profile, siteRatingAverage] = await Promise.all([
      this.userTasteProfileRepository.read.findOne({ user: props.userId }),
      this.userItemRepository.getRatingAverage(),
    ])

    return {
      userId: props.userId,
      preferences: profile?.tagPreferences ?? [],
      siteRatingAverage,
      now: new Date(),
      filter: props.filter,
      library: props.library,
      excludeItemIds: props.excludeItemIds,
      collectionGroupIds,
      candidateItemIds: props.candidateItemIds,
      isIncludingExcluded: props.isIncludingExcluded,
      direction: props.direction,
    }
  }

  private validateConditions(props: IFindRecommendationsProps) {
    if (
      !isUndefined(props.library?.include) &&
      !isUndefined(props.library.only)
    ) {
      throw new BadRequestException(
        DICTIONARY.recommendations.conflictingLibrary,
      )
    }

    const filter = props.filter

    if (!isUndefined(filter?.groupId) && isUndefined(filter.collectionId)) {
      throw new BadRequestException(
        DICTIONARY.recommendations.collectionRequired,
      )
    }

    const { ratingMin, ratingMax } = filter ?? {}

    if (
      [ratingMin, ratingMax].some(
        (value) =>
          !isUndefined(value) &&
          (!isFiniteNumber(value) || value < 1 || value > 10),
      ) ||
      (!isUndefined(ratingMin) &&
        !isUndefined(ratingMax) &&
        ratingMin > ratingMax)
    ) {
      throw new BadRequestException(
        DICTIONARY.recommendations.invalidRatingRange,
      )
    }

    for (const field of filter?.fields ?? []) {
      if (!Object.hasOwn(ITEM_FIELD_DEFINITIONS, field.field)) {
        throw new BadRequestException(
          DICTIONARY.recommendations.invalidFieldRange,
        )
      }

      const definition = ITEM_FIELD_DEFINITIONS[field.field]
      const bounds = [field.min, field.max].filter(
        (value) => !isUndefined(value),
      )

      if (
        bounds.length === 0 ||
        bounds.some((value) => {
          return definition.valueType === EItemFieldValueType.DATE
            ? !isDate(value)
            : !isFiniteNumber(value)
        }) ||
        (!isUndefined(field.min) &&
          !isUndefined(field.max) &&
          field.min > field.max)
      ) {
        throw new BadRequestException(
          DICTIONARY.recommendations.invalidFieldRange,
        )
      }
    }
  }

  private async getCollectionGroupIds(
    filter: IFindRecommendationsProps["filter"],
  ) {
    if (isUndefined(filter?.collectionId)) {
      return undefined
    }

    const collection = await this.collectionRepository.findNotDeletedById(
      filter.collectionId,
    )

    if (isNil(collection)) {
      throw new NotFoundException(DICTIONARY.collection.notFound)
    }

    const groupIds = collection.blocks
      .filter((block) => block.type === ECollectionBlockType.GROUP)
      .map((block) => block.id)

    if (isUndefined(filter.groupId)) {
      return groupIds
    }

    if (!groupIds.some((id) => id.equals(filter.groupId))) {
      throw new BadRequestException(DICTIONARY.collection.invalidGroup)
    }

    return [filter.groupId]
  }
}

export { RecommendationsService }
