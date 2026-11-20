import { REGEX } from "@shared/static/REGEX"
import { ELanguage } from "@entities/shared/schemas/ELanguage"
import { Injectable, NotFoundException } from "@nestjs/common"
import { Types } from "mongoose"

import { CollectionRepository } from "@entities/collection/services/collectionRepository"
import { ItemCollectionRepository } from "@entities/itemCollection/services/itemCollectionRepository"
import { ECollectionBlockType } from "@entities/collection/schemas/ECollectionBlockType"
import { EItemType } from "@entities/item/schemas/EItemType"
import { UserCollectionRepository } from "@entities/userCollection/services/userCollectionRepository"
import { EUserItemStatus } from "@entities/userItem/schemas/EUserItemStatus"
import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { CollectionAuthService } from "@endpoints/collection/services/collectionAuthService"
import { CursorService } from "@infrastructure/cache/services/cursorService"
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
  ) {}

  async getItems(
    props: IGetItemCollectionsRequestProps,
  ): Promise<ItemCollectionsResponseDto> {
    const { accessToken, id, query } = props
    const { types, limit = 50 } = query
    const allTypes = Object.values(EItemType)
    const filteredTypes = types?.length === allTypes.length ? undefined : types
    const userId = isUndefined(accessToken)
      ? undefined
      : await this.collectionAuthService.authenticate(accessToken)
    const isPersonalFilterApplied =
      !isUndefined(userId) && query.isPersonalFilteringEnabled === true
    const { collection, groupIds } = await this.getContentContext(id)
    const scope = [
      "collectionItems",
      id.toHexString(),
      collection.version,
      [...(filteredTypes ?? allTypes)].sort(),
      limit,
      userId?.toHexString() ?? null,
      isPersonalFilterApplied,
    ]
    const after = this.readCursor(query.cursor, scope, groupIds.length)
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

    if (isPersonalFilterApplied) {
      const reaction =
        await this.userCollectionRepository.findByUserAndCollection(userId, id)

      if (reaction?.isHidden === true) {
        return { nextCursor: null, blocks: [], ...metadata, isHidden: true }
      }
    }

    const rows = await this.itemCollectionRepository.readContentSlice({
      collectionId: id,
      groupIds,
      after,
      limit: limit + 1,
      types: filteredTypes,
      userId,
      isPersonalFilterApplied,
    })
    if (
      (!isUndefined(filteredTypes) || isPersonalFilterApplied) &&
      rows.length === 0
    ) {
      return { nextCursor: null, blocks: [], ...metadata, isHidden: false }
    }

    const page = rows.slice(0, limit)
    const last = page.at(-1)
    const nextCursor =
      rows.length > limit && !isUndefined(last)
        ? this.cursorService.create({
            scope,
            position: [last.groupOrder, last.position, last._id.toHexString()],
          })
        : null
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
    for (const block of collection.blocks) {
      if (block.type === ECollectionBlockType.TEXT) {
        if (groupOrder >= (after?.groupOrder ?? -1)) {
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
    if (isNil(nextCursor)) {
      blocks.push(...pendingText)
    }

    return {
      nextCursor,
      blocks,
      ...metadata,
      isHidden: false,
    }
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

  private mapItem(
    card: Awaited<
      ReturnType<ItemCollectionRepository["readContentSlice"]>
    >[number],
  ): CollectionGroupItemResponseDto {
    const status = card.viewerItem?.status

    return {
      id: card.item._id.toHexString(),
      type: card.item.type,
      title: {
        [ELanguage.RUSSIAN]: card.item.title[ELanguage.RUSSIAN],
        [ELanguage.ENGLISH]: card.item.title[ELanguage.ENGLISH],
      },
      media: (card.item.media ?? []).map((media) => ({
        src: media.src,
        language: media.language,
        type: media.type,
      })),
      note: card.note,
      ratingAverage: card.ratingAverage ?? null,
      userRating: card.viewerItem?.rating ?? null,
      userStatus:
        status === EUserItemStatus.BLOCKED || status === EUserItemStatus.SKIPPED
          ? null
          : (status ?? null),
    }
  }
}

export { CollectionContentService }
