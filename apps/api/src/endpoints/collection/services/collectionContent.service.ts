import { ELanguage } from "@entities/shared/schemas/ELanguage"
import { ITEM_FIELD_DEFINITIONS } from "@entities/item/static/ITEM_FIELD_DEFINITIONS"
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
import { Types } from "mongoose"
import { isISO8601 } from "class-validator"

import { CollectionRepository } from "@entities/collection/services/collection.repository"
import { ItemCollectionRepository } from "@entities/itemCollection/services/itemCollection.repository"
import { ECollectionBlockType } from "@entities/collection/schemas/ECollectionBlockType"
import { ECollectionType } from "@entities/collection/schemas/ECollectionType"
import { EItemFieldValueType } from "@entities/item/schemas/EItemFieldValueType"
import type { TCollectionFieldOptions } from "@entities/itemCollection/types/TCollectionFieldOptions"
import type { TCollectionFieldFilter } from "@entities/itemCollection/types/TCollectionFieldFilter"
import type { IItemCollectionCard } from "@entities/itemCollection/types/IItemCollectionCard"
import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { isNil } from "@shared/functions/checks/isNil"
import { isDate } from "@shared/functions/checks/isDate"
import { isUndefined } from "@shared/functions/checks/isUndefined"
import { isString } from "@shared/functions/checks/isString"
import { isFiniteNumber } from "@shared/functions/checks/isFiniteNumber"
import { normalizePagination } from "@shared/functions/pagination/normalizePagination"
import { createPaginatedResult } from "@shared/functions/pagination/createPaginatedResult"

import type { CollectionFiltersResponseDto } from "../dto/response/collectionFilters.response"
import { ECollectionMode } from "../types/ECollectionMode"
import { ECollectionSort } from "../types/ECollectionSort"
import type { IGetItemCollectionsRequestProps } from "../types/IGetItemCollectionsRequestProps"
import type { CollectionFieldFilterQueryDto } from "../dto/query/collectionFieldFilter.query"
import type { ItemCollectionResponseDto } from "../dto/response/itemCollection.response"
import type { ItemCollectionsResponseDto } from "../dto/response/itemCollections.response"
import { createCollectionDisplayBlocks } from "../functions/createCollectionDisplayBlocks"

@Injectable()
class CollectionContentService {
  constructor(
    private readonly collectionRepository: CollectionRepository,
    private readonly itemCollectionRepository: ItemCollectionRepository,
  ) {}

  async getFilters(id: Types.ObjectId): Promise<CollectionFiltersResponseDto> {
    const { collection, groupIds } = await this.getContentContext(id)

    const options = await this.itemCollectionRepository.getFilterOptions({
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
        name: {
          [ELanguage.RUSSIAN]: tag.name[ELanguage.RUSSIAN],
          [ELanguage.ENGLISH]: tag.name[ELanguage.ENGLISH],
        },
      })),
      fields: options.fields.map((field) => this.mapField(field)),
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
  }: IGetItemCollectionsRequestProps): Promise<ItemCollectionsResponseDto> {
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

    if (
      query.sort === ECollectionSort.RELEVANCE_SCORE &&
      collection.type !== ECollectionType.TAG
    ) {
      throw new BadRequestException(DICTIONARY.collection.unavailableSort)
    }

    const fields = this.prepareFieldFilters(query.fields)
    const groupCounts =
      await this.itemCollectionRepository.countAvailableItemsByGroup({
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

    const direction =
      query.direction ??
      (query.sort === ECollectionSort.RELEVANCE_SCORE ? "desc" : "asc")
    const result = await this.itemCollectionRepository.readContentPage({
      collectionId: id,
      groupIds,
      groupId,
      isGrouped: mode === ECollectionMode.GROUPED,
      sort: query.sort ?? ECollectionSort.COLLECTION,
      direction: direction === "desc" ? -1 : 1,
      language: query.language ?? ELanguage.RUSSIAN,
      page,
      limit,
      tags: (query.tags ?? []).map((id) => new Types.ObjectId(id)),
      excludeTags: (query.excludeTags ?? []).map(
        (id) => new Types.ObjectId(id),
      ),
      fields,
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
      query.fields,
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

  private prepareFieldFilters(
    filters: CollectionFieldFilterQueryDto[] = [],
  ): TCollectionFieldFilter[] {
    if (
      new Set(filters.map((filter) => filter.field)).size !== filters.length
    ) {
      throw new BadRequestException(DICTIONARY.collection.invalidFieldFilters)
    }

    return filters.map((filter): TCollectionFieldFilter => {
      const definition = ITEM_FIELD_DEFINITIONS[filter.field]

      if (
        isUndefined(definition) ||
        (isUndefined(filter.min) && isUndefined(filter.max))
      ) {
        throw new BadRequestException(DICTIONARY.collection.invalidFieldFilters)
      }

      if (definition.valueType === EItemFieldValueType.NUMBER) {
        if (
          (!isUndefined(filter.min) && !isFiniteNumber(filter.min)) ||
          (!isUndefined(filter.max) && !isFiniteNumber(filter.max))
        ) {
          throw new BadRequestException(
            DICTIONARY.collection.invalidFieldFilters,
          )
        }

        const min = isFiniteNumber(filter.min) ? filter.min : undefined
        const max = isFiniteNumber(filter.max) ? filter.max : undefined

        if (!isUndefined(min) && !isUndefined(max) && min > max) {
          throw new BadRequestException(
            DICTIONARY.collection.invalidFieldFilters,
          )
        }

        return {
          field: filter.field,
          valueType: EItemFieldValueType.NUMBER,
          min,
          max,
        }
      }

      const min = this.parseFieldDate(filter.min)
      const max = this.parseFieldDate(filter.max)

      if (!isUndefined(min) && !isUndefined(max) && min > max) {
        throw new BadRequestException(DICTIONARY.collection.invalidFieldFilters)
      }

      return {
        field: filter.field,
        valueType: EItemFieldValueType.DATE,
        min,
        max,
      }
    })
  }

  private parseFieldDate(value: unknown) {
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
      throw new BadRequestException(DICTIONARY.collection.invalidFieldFilters)
    }

    const date = new Date(value)

    if (!isDate(date)) {
      throw new BadRequestException(DICTIONARY.collection.invalidFieldFilters)
    }

    return date
  }

  private mapItem(card: IItemCollectionCard): ItemCollectionResponseDto {
    return {
      id: card.item._id.toHexString(),
      type: card.item.type,
      title: {
        [ELanguage.RUSSIAN]: card.item.title[ELanguage.RUSSIAN],
        [ELanguage.ENGLISH]: card.item.title[ELanguage.ENGLISH],
      },
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

  private mapField(
    field: TCollectionFieldOptions,
  ): CollectionFiltersResponseDto["fields"][number] {
    const definition = ITEM_FIELD_DEFINITIONS[field.field]
    const metadata = {
      field: field.field,
      name: definition.name,
      unit: definition.unit,
    }

    if (field.valueType === EItemFieldValueType.DATE) {
      return {
        ...metadata,
        valueType: field.valueType,
        min: field.min.toISOString(),
        max: field.max.toISOString(),
      }
    }

    return {
      ...metadata,
      valueType: field.valueType,
      min: field.min,
      max: field.max,
    }
  }
}

export { CollectionContentService }
