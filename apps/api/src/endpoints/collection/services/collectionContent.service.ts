import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
import { Types } from "mongoose"
import { isISO8601 } from "class-validator"

import { CollectionRepository } from "@entities/collection/services/collection.repository"
import { CollectionItemRepository } from "@entities/collectionItem/services/collectionItem.repository"
import { ECollectionBlockType } from "@entities/collection/schemas/ECollectionBlockType"
import { EFeatureValueType } from "@entities/feature/schemas/EFeatureValueType"
import type { TCollectionFeatureOptions } from "@entities/collectionItem/types/TCollectionFeatureOptions"
import type { TCollectionFeatureFilter } from "@entities/collectionItem/types/TCollectionFeatureFilter"
import type { ICollectionItemCard } from "@entities/collectionItem/types/ICollectionItemCard"
import { FeatureRepository } from "@entities/feature/services/feature.repository"
import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { isNil } from "@shared/functions/checks/isNil"
import { isUndefined } from "@shared/functions/checks/isUndefined"
import { isString } from "@shared/functions/checks/isString"
import { isFiniteNumber } from "@shared/functions/checks/isFiniteNumber"
import { normalizePagination } from "@shared/functions/pagination/normalizePagination"
import { createPaginatedResult } from "@shared/functions/pagination/createPaginatedResult"

import type { CollectionFiltersResponseDto } from "../dto/response/collectionFilters.response"
import { ECollectionMode } from "../types/ECollectionMode"
import { ECollectionSort } from "../types/ECollectionSort"
import type { IGetCollectionItemsRequestProps } from "../types/IGetCollectionItemsRequestProps"
import type { CollectionFeatureFilterQueryDto } from "../dto/query/collectionFeatureFilter.query"
import type { CollectionItemResponseDto } from "../dto/response/collectionItem.response"
import type { CollectionItemsResponseDto } from "../dto/response/collectionItems.response"
import { createCollectionDisplayBlocks } from "../functions/createCollectionDisplayBlocks"

@Injectable()
class CollectionContentService {
  constructor(
    private readonly collectionRepository: CollectionRepository,
    private readonly collectionItemRepository: CollectionItemRepository,
    private readonly featureRepository: FeatureRepository,
  ) {}

  async getFilters(id: Types.ObjectId): Promise<CollectionFiltersResponseDto> {
    const { collection, groupIds } = await this.getContentContext(id)

    const options = await this.collectionItemRepository.getFilterOptions({
      collectionId: id,
      groupIds,
    })
    const isGroupedModeAvailable =
      options.nonEmptyGroupIds.length >= 2 ||
      collection.blocks.some(
        (block) => block.type === ECollectionBlockType.TEXT,
      )

    return {
      tags: options.tags.map((tag) => ({
        id: tag._id.toHexString(),
        key: tag.key,
        group: tag.group,
        name: { ru: tag.name.ru, en: tag.name.en },
      })),
      features: options.features.map((feature) => this.mapFeature(feature)),
      sorting: {
        availableModes: isGroupedModeAvailable
          ? [ECollectionMode.FLAT, ECollectionMode.GROUPED]
          : [ECollectionMode.FLAT],
      },
    }
  }

  async getItems({
    id,
    query,
  }: IGetCollectionItemsRequestProps): Promise<CollectionItemsResponseDto> {
    const { page, limit } = normalizePagination(query, 20)

    if (!Number.isSafeInteger((page - 1) * limit)) {
      throw new BadRequestException(DICTIONARY.collection.invalidPagination)
    }

    if (
      !isUndefined(query.ratingMin) &&
      !isUndefined(query.ratingMax) &&
      query.ratingMin > query.ratingMax
    ) {
      throw new BadRequestException(DICTIONARY.collection.invalidRatingRange)
    }

    const { collection, groupIds, groupId } = await this.getContentContext(
      id,
      query.groupId,
    )
    const features = await this.prepareFeatureFilters(query.features)
    const groupCounts =
      await this.collectionItemRepository.countAvailableItemsByGroup({
        collectionId: id,
        groupIds,
      })
    const isGroupedModeAvailable =
      groupCounts.length >= 2 ||
      collection.blocks.some(
        (block) => block.type === ECollectionBlockType.TEXT,
      )
    const mode =
      query.mode ??
      (isGroupedModeAvailable ? ECollectionMode.GROUPED : ECollectionMode.FLAT)

    if (mode === ECollectionMode.GROUPED && !isGroupedModeAvailable) {
      throw new BadRequestException(DICTIONARY.collection.unavailableMode)
    }

    const result = await this.collectionItemRepository.readContentPage({
      collectionId: id,
      groupIds,
      groupId,
      isGrouped: mode === ECollectionMode.GROUPED,
      sort: query.sort ?? ECollectionSort.COLLECTION,
      direction: query.direction === "desc" ? -1 : 1,
      language: query.language ?? "ru",
      page,
      limit,
      tags: (query.tags ?? []).map((id) => new Types.ObjectId(id)),
      excludeTags: (query.excludeTags ?? []).map(
        (id) => new Types.ObjectId(id),
      ),
      features,
      query: query.query,
      ratingMin: query.ratingMin,
      ratingMax: query.ratingMax,
    })
    const response = createPaginatedResult(
      result.items.map((item) => this.mapItem(item)),
      result.total,
      page,
      limit,
    )
    const isFiltered = [
      query.groupId,
      query.query,
      query.tags,
      query.excludeTags,
      query.features,
      query.ratingMin,
      query.ratingMax,
    ].some((value) => !isUndefined(value))

    return {
      ...response,
      mode,
      displayBlocks:
        mode === ECollectionMode.FLAT
          ? []
          : createCollectionDisplayBlocks({
              blocks: collection.blocks,
              groupCounts,
              page: response,
              isFiltered,
            }),
    }
  }

  private async getContentContext(
    id: Types.ObjectId,
    requestedGroupId?: string,
  ) {
    const collection = await this.collectionRepository.findNotDeletedById(id)

    if (isNil(collection)) {
      throw new NotFoundException(DICTIONARY.collection.notFound)
    }

    const groupIds = collection.blocks
      .filter((block) => block.type === ECollectionBlockType.GROUP)
      .map((block) => block.id)
    const groupId = isUndefined(requestedGroupId)
      ? undefined
      : new Types.ObjectId(requestedGroupId)

    if (!isUndefined(groupId) && !groupIds.some((id) => id.equals(groupId))) {
      throw new BadRequestException(DICTIONARY.collection.invalidGroup)
    }

    return { collection, groupIds, groupId }
  }

  private async prepareFeatureFilters(
    filters: CollectionFeatureFilterQueryDto[] = [],
  ): Promise<TCollectionFeatureFilter[]> {
    if (filters.length === 0) {
      return []
    }

    const ids = filters.map((filter) => new Types.ObjectId(filter.featureId))

    if (new Set(ids.map((id) => id.toHexString())).size !== ids.length) {
      throw new BadRequestException(DICTIONARY.collection.invalidFeatureFilters)
    }

    const definitions =
      await this.featureRepository.findFilterDefinitionsByIds(ids)
    const byId = new Map(
      definitions.map((definition) => [
        definition._id.toHexString(),
        definition,
      ]),
    )

    return filters.map((filter): TCollectionFeatureFilter => {
      const featureId = new Types.ObjectId(filter.featureId)
      const definition = byId.get(featureId.toHexString())

      if (isUndefined(definition)) {
        throw new BadRequestException(
          DICTIONARY.collection.invalidFeatureFilters,
        )
      }

      if (definition.valueType === EFeatureValueType.BOOLEAN) {
        if (
          isUndefined(filter.values) ||
          !isUndefined(filter.min) ||
          !isUndefined(filter.max)
        ) {
          throw new BadRequestException(
            DICTIONARY.collection.invalidFeatureFilters,
          )
        }

        return {
          featureId,
          valueType: EFeatureValueType.BOOLEAN,
          values: filter.values,
        }
      }

      if (
        !isUndefined(filter.values) ||
        (isUndefined(filter.min) && isUndefined(filter.max))
      ) {
        throw new BadRequestException(
          DICTIONARY.collection.invalidFeatureFilters,
        )
      }

      if (definition.valueType === EFeatureValueType.NUMBER) {
        if (
          (!isUndefined(filter.min) && !isFiniteNumber(filter.min)) ||
          (!isUndefined(filter.max) && !isFiniteNumber(filter.max))
        ) {
          throw new BadRequestException(
            DICTIONARY.collection.invalidFeatureFilters,
          )
        }

        if (
          !isUndefined(filter.min) &&
          !isUndefined(filter.max) &&
          filter.min > filter.max
        ) {
          throw new BadRequestException(
            DICTIONARY.collection.invalidFeatureFilters,
          )
        }

        return {
          featureId,
          valueType: EFeatureValueType.NUMBER,
          min: filter.min,
          max: filter.max,
        }
      }

      if (definition.valueType === EFeatureValueType.DATE) {
        const min = this.parseFeatureDate(filter.min)
        const max = this.parseFeatureDate(filter.max)

        if (!isUndefined(min) && !isUndefined(max) && min > max) {
          throw new BadRequestException(
            DICTIONARY.collection.invalidFeatureFilters,
          )
        }

        return { featureId, valueType: EFeatureValueType.DATE, min, max }
      }

      throw new BadRequestException(DICTIONARY.collection.invalidFeatureFilters)
    })
  }

  private parseFeatureDate(value: unknown) {
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
      throw new BadRequestException(DICTIONARY.collection.invalidFeatureFilters)
    }

    const date = new Date(value)

    if (!Number.isFinite(date.getTime())) {
      throw new BadRequestException(DICTIONARY.collection.invalidFeatureFilters)
    }

    return date
  }

  private mapItem(card: ICollectionItemCard): CollectionItemResponseDto {
    return {
      id: card.item._id.toHexString(),
      type: card.item.type,
      title: { ru: card.item.title.ru, en: card.item.title.en },
      media: card.item.media.map((media) => ({
        src: media.src,
        language: media.language,
        type: media.type,
      })),
      membership: {
        groupId: card.groupId.toHexString(),
        position: card.position,
        note: card.note,
      },
    }
  }

  private mapFeature(
    feature: TCollectionFeatureOptions,
  ): CollectionFiltersResponseDto["features"][number] {
    const metadata = {
      id: feature._id.toHexString(),
      key: feature.key,
      group: feature.group,
      name: { ru: feature.name.ru, en: feature.name.en },
      unit: feature.unit,
    }

    switch (feature.valueType) {
      case EFeatureValueType.NUMBER:
        return {
          ...metadata,
          valueType: feature.valueType,
          min: feature.min,
          max: feature.max,
        }
      case EFeatureValueType.DATE:
        return {
          ...metadata,
          valueType: feature.valueType,
          min: feature.min.toISOString(),
          max: feature.max.toISOString(),
        }
      case EFeatureValueType.BOOLEAN:
        return {
          ...metadata,
          valueType: feature.valueType,
          values: feature.values.sort(
            (isFirst, isSecond) => Number(isFirst) - Number(isSecond),
          ),
        }
    }
  }
}

export { CollectionContentService }
