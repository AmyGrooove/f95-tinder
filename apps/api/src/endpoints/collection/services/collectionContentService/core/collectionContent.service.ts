import { REGEX } from "@shared/static/REGEX"
import { ELanguage } from "@entities/shared/schemas/ELanguage"
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
import { Types } from "mongoose"

import { CollectionRepository } from "@entities/collection/services/collectionRepository"
import type { CollectionBlock } from "@entities/collection/schemas/collectionBlock.schema"
import { ItemCollectionRepository } from "@entities/itemCollection/services/itemCollectionRepository"
import type { IItemCollectionCard } from "@entities/itemCollection/services/itemCollectionRepository"
import { ECollectionBlockType } from "@entities/collection/schemas/ECollectionBlockType"
import { EItemType } from "@entities/item/schemas/EItemType"
import { UserCollectionRepository } from "@entities/userCollection/services/userCollectionRepository"
import { EUserItemStatus } from "@entities/userItem/schemas/EUserItemStatus"
import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { ESort } from "@entities/shared/types/ESort"
import { ESortDirection } from "@entities/shared/types/ESortDirection"
import { CollectionAuthService } from "@endpoints/collection/services/collectionAuthService"
import { mapMediaSources } from "@endpoints/shared/functions/mapMediaSources"
import { ECollectionMode } from "@endpoints/collection/types/ECollectionMode"
import { ECollectionSort } from "@endpoints/collection/types/ECollectionSort"
import { CursorService } from "@infrastructure/cache/services/cursorService"
import { StorageService } from "@infrastructure/storage/services/storageService"
import { isArray } from "@shared/functions/checks/isArray"
import { isInt } from "@shared/functions/checks/isInt"
import { isNonNegativeSafe } from "@shared/functions/checks/isNonNegativeSafe"
import { isNil } from "@shared/functions/checks/isNil"
import { isString } from "@shared/functions/checks/isString"
import { isUndefined } from "@shared/functions/checks/isUndefined"

import type { IGetItemCollectionsRequestProps } from "../types/IGetItemCollectionsRequestProps"
import type {
  CollectionGroupItemResponseDto,
  ItemCollectionsResponseDto,
} from "../dto/itemCollections.response"

@Injectable()
class CollectionContentService {
  constructor(
    private readonly collectionRepository: CollectionRepository,
    private readonly itemCollectionRepository: ItemCollectionRepository,
    private readonly userCollectionRepository: UserCollectionRepository,
    private readonly collectionAuthService: CollectionAuthService,
    private readonly cursorService: CursorService,
    private readonly storageService: StorageService,
  ) {}

  async getItems(
    props: IGetItemCollectionsRequestProps,
  ): Promise<ItemCollectionsResponseDto> {
    const { accessToken, id, query } = props
    const {
      cursor,
      types,
      search,
      rating,
      limit = 50,
      mode = ECollectionMode.GROUPED,
      sort = ECollectionSort.COLLECTION,
    } = query
    const isGrouped = mode === ECollectionMode.GROUPED
    const isAuthorOrder = sort === ECollectionSort.COLLECTION
    const direction =
      query.direction ??
      (sort === ESort.TITLE ? ESortDirection.ASC : ESortDirection.DESC)
    const language =
      sort === ESort.TITLE
        ? (query.language ?? ELanguage.RUSSIAN)
        : ELanguage.RUSSIAN
    const isDefaultView =
      isGrouped && isAuthorOrder && isUndefined(search) && isUndefined(rating)

    if (!isUndefined(rating)) {
      const { min, max } = rating
      if ((isUndefined(min) && isUndefined(max)) || (min ?? 1) > (max ?? 10)) {
        throw new BadRequestException(
          DICTIONARY.collection.invalidItemsRatingRange,
        )
      }
    }

    const allTypes = Object.values(EItemType)
    const filteredTypes = types?.length === allTypes.length ? undefined : types
    const userId = isUndefined(accessToken)
      ? undefined
      : await this.collectionAuthService.authenticate(accessToken)
    const isCollectionHideFilterApplied =
      !isUndefined(userId) && query.isPersonalFilteringEnabled === true
    const isItemStatusOnlyFilterApplied =
      !isUndefined(userId) &&
      !isCollectionHideFilterApplied &&
      query.isItemStatusFilteringEnabled === true
    const isItemStatusFilterApplied =
      isCollectionHideFilterApplied || isItemStatusOnlyFilterApplied
    const { collection, groupIds } = await this.getContentContext(id)
    const scope = [
      "collectionItems",
      id.toHexString(),
      collection.version,
      [...(filteredTypes ?? allTypes)].sort(),
      limit,
      userId?.toHexString() ?? null,
      isCollectionHideFilterApplied,
      ...(isDefaultView
        ? []
        : [
            mode,
            sort,
            isAuthorOrder ? null : direction,
            language,
            search ?? null,
            rating?.min ?? null,
            rating?.max ?? null,
          ]),
      ...(isItemStatusOnlyFilterApplied ? ["itemStatusFilter"] : []),
    ]
    const after = isAuthorOrder
      ? this.readCursor(cursor, scope, groupIds.length)
      : undefined
    const sortedPosition = isAuthorOrder
      ? undefined
      : this.readSortedCursor(cursor, scope, groupIds.length, limit)
    const offset = sortedPosition?.offset ?? 0
    const metadata =
      query.isMetadataIncluded === true
        ? {
            metadata: {
              label: {
                ru: collection.title.ru ?? null,
                en: collection.title.en ?? null,
              },
              description: {
                ru: collection.description?.ru ?? null,
                en: collection.description?.en ?? null,
              },
            },
          }
        : {}

    if (isCollectionHideFilterApplied) {
      const reaction =
        await this.userCollectionRepository.findByUserAndCollection(userId, id)

      if (reaction?.isHidden === true) {
        return {
          nextCursor: null,
          blocks: [],
          ...(!isGrouped && { items: [] }),
          ...metadata,
          isHidden: true,
        }
      }
    }

    const rows = await this.itemCollectionRepository.readContentSlice({
      collectionId: id,
      groupIds,
      after,
      limit: limit + 1,
      types: filteredTypes,
      userId,
      isPersonalFilterApplied: isItemStatusFilterApplied,
      isGrouped,
      search,
      rating,
      sort: isAuthorOrder
        ? undefined
        : {
            field: sort,
            direction: direction === ESortDirection.ASC ? 1 : -1,
            language,
            offset,
          },
    })

    const page = rows.slice(0, limit)
    const last = page.at(-1)
    const nextCursor =
      rows.length > limit && !isUndefined(last)
        ? this.cursorService.create({
            scope,
            position: isAuthorOrder
              ? [last.groupOrder, last.position, last._id.toHexString()]
              : [offset + limit, last.groupOrder],
          })
        : null

    const response = { nextCursor, ...metadata, isHidden: false }

    if (!isGrouped) {
      return {
        ...response,
        blocks: [],
        items: page.map((row) => this.mapItem(row)),
      }
    }

    const isFiltered =
      !isUndefined(filteredTypes) ||
      isItemStatusFilterApplied ||
      !isUndefined(search) ||
      !isUndefined(rating)
    const blocks =
      rows.length === 0 && isFiltered
        ? []
        : this.mapBlocks(
            collection.blocks,
            page,
            after?.groupOrder ?? sortedPosition?.groupOrder ?? -1,
            isNil(nextCursor),
          )

    return { ...response, blocks }
  }

  private mapBlocks(
    collectionBlocks: readonly CollectionBlock[],
    page: readonly IItemCollectionCard[],
    previousGroupOrder: number,
    isLastPage: boolean,
  ): ItemCollectionsResponseDto["blocks"] {
    const itemsByGroup = new Map<string, CollectionGroupItemResponseDto[]>()
    for (const row of page) {
      const groupId = row.groupId.toHexString()
      const group = itemsByGroup.get(groupId) ?? []
      group.push(this.mapItem(row))
      itemsByGroup.set(groupId, group)
    }

    const blocks: ItemCollectionsResponseDto["blocks"] = []
    let pendingText: ItemCollectionsResponseDto["blocks"] = []
    let groupOrder = -1
    for (const block of collectionBlocks) {
      if (block.type === ECollectionBlockType.TEXT) {
        if (groupOrder >= previousGroupOrder) {
          pendingText.push({
            type: block.type,
            content: {
              ru: block.content?.ru ?? null,
              en: block.content?.en ?? null,
            },
          })
        }
        continue
      }

      groupOrder += 1
      const group = itemsByGroup.get(block.id.toHexString())
      if (isUndefined(group)) {
        continue
      }

      blocks.push(...pendingText, {
        id: block.id.toHexString(),
        type: block.type,
        title: isNil(block.title)
          ? null
          : { ru: block.title.ru, en: block.title.en },
        description: isNil(block.description)
          ? null
          : { ru: block.description.ru, en: block.description.en },
        items: group,
      })
      pendingText = []
    }
    if (isLastPage) {
      blocks.push(...pendingText)
    }

    return blocks
  }

  private readSortedCursor(
    cursor: string | undefined,
    scope: readonly unknown[],
    groupCount: number,
    limit: number,
  ) {
    if (isUndefined(cursor)) {
      return undefined
    }

    const [offset, groupOrder] = this.cursorService.read({
      cursor,
      scope,
      isPosition: (value): value is [number, number] =>
        isArray(value) &&
        value.length === 2 &&
        isInt(value[0]) &&
        value[0] >= limit &&
        value[0] <= Number.MAX_SAFE_INTEGER - limit &&
        value[0] % limit === 0 &&
        isInt(value[1]) &&
        isNonNegativeSafe(value[1]) &&
        value[1] < groupCount,
      invalidCursorMessage: DICTIONARY.collection.invalidItemsCursor,
    })

    return { offset, groupOrder }
  }

  private readCursor(
    cursor: string | undefined,
    scope: readonly unknown[],
    groupCount: number,
  ) {
    if (isUndefined(cursor)) {
      return undefined
    }

    const [groupOrder, position, id] = this.cursorService.read({
      cursor,
      scope,
      isPosition: (value): value is [number, number, string] =>
        isArray(value) &&
        value.length === 3 &&
        isInt(value[0]) &&
        isNonNegativeSafe(value[0]) &&
        value[0] < groupCount &&
        isInt(value[1]) &&
        isNonNegativeSafe(value[1]) &&
        isString(value[2]) &&
        REGEX.MONGO_OBJECT_ID.test(value[2]),
      invalidCursorMessage: DICTIONARY.collection.invalidItemsCursor,
    })

    return { groupOrder, position, id: new Types.ObjectId(id) }
  }

  private async getContentContext(id: Types.ObjectId) {
    const collection = await this.collectionRepository.findNotDeletedById(id)

    if (isNil(collection)) {
      throw new NotFoundException(DICTIONARY.collection.notFound)
    }

    const groupIds = collection.blocks
      .filter((block) => block.type === ECollectionBlockType.GROUP)
      .map((block) => block.id)

    return { collection, groupIds }
  }

  private mapItem(card: IItemCollectionCard): CollectionGroupItemResponseDto {
    const status = card.viewerItem?.status
    const userStatus =
      status === EUserItemStatus.BLOCKED || status === EUserItemStatus.SKIPPED
        ? null
        : (status ?? null)

    return {
      id: card.item._id.toHexString(),
      type: card.item.type,
      title: {
        [ELanguage.RUSSIAN]: card.item.title[ELanguage.RUSSIAN],
        [ELanguage.ENGLISH]: card.item.title[ELanguage.ENGLISH],
      },
      media: mapMediaSources(card.item.media ?? [], this.storageService),
      note: card.note,
      ratingAverage: card.ratingAverage ?? null,
      userRating: card.viewerItem?.rating ?? null,
      userStatus,
      userProgress: isNil(userStatus)
        ? null
        : (card.viewerItem?.progress ?? null),
    }
  }
}

export { CollectionContentService }
