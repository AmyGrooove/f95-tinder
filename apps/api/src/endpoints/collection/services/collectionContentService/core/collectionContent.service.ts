import { REGEX } from "@shared/static/REGEX"
import { ELanguage } from "@entities/shared/schemas/ELanguage"
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
import { Types } from "mongoose"

import { CollectionRepository } from "@entities/collection/services/collectionRepository"
import { ItemCollectionRepository } from "@entities/itemCollection/services/itemCollectionRepository"
import { ECollectionBlockType } from "@entities/collection/schemas/ECollectionBlockType"
import type { IItemCollectionCard } from "@entities/itemCollection/services/itemCollectionRepository"
import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { isNil } from "@shared/functions/checks/isNil"
import { isUndefined } from "@shared/functions/checks/isUndefined"

import type { IGetItemCollectionsRequestProps } from "../types/IGetItemCollectionsRequestProps"
import type { ItemCollectionResponseDto } from "../dto/itemCollection.response"
import type { ItemCollectionsResponseDto } from "../dto/itemCollections.response"

@Injectable()
class CollectionContentService {
  constructor(
    private readonly collectionRepository: CollectionRepository,
    private readonly itemCollectionRepository: ItemCollectionRepository,
  ) {}

  async getItems(
    props: IGetItemCollectionsRequestProps,
  ): Promise<ItemCollectionsResponseDto> {
    const { id, query } = props

    const limit = query.limit ?? 50
    const { collection, groupIds } = await this.getContentContext(id)
    const scope = id.toHexString() + ":" + collection.version + ":"
    const after = this.readCursor(query.cursor, scope, groupIds.length)
    const rows = await this.itemCollectionRepository.readContentSlice({
      collectionId: id,
      groupIds,
      after,
      limit: limit + 1,
    })
    const page = rows.slice(0, limit)
    const last = page.at(-1)
    const nextCursor =
      rows.length > limit && !isUndefined(last)
        ? Buffer.from(
            scope +
              last.groupOrder +
              ":" +
              last.position +
              ":" +
              last._id.toHexString(),
          ).toString("base64url")
        : null
    const items = page.map((row) => this.mapItem(row))
    const itemsByGroup = new Map<string, ItemCollectionResponseDto[]>()
    for (const item of items) {
      const group = itemsByGroup.get(item.membership.groupId) ?? []
      group.push(item)
      itemsByGroup.set(item.membership.groupId, group)
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
        items: group.map((props) => {
          const { membership, ...item } = props

          return {
            ...item,
            note: membership.note,
          }
        }),
      })
      pendingText = []
    }
    if (nextCursor === null) {
      blocks.push(...pendingText)
    }

    return { nextCursor, blocks }
  }

  private readCursor(
    cursor: string | undefined,
    scope: string,
    groupCount: number,
  ) {
    if (isUndefined(cursor)) {
      return undefined
    }

    const decoded = Buffer.from(cursor, "base64url").toString()
    const [group, offset, id, extra] = decoded.slice(scope.length).split(":")
    const groupOrder = Number(group)
    const position = Number(offset)
    if (
      !decoded.startsWith(scope) ||
      group !== String(groupOrder) ||
      offset !== String(position) ||
      !Number.isSafeInteger(groupOrder) ||
      groupOrder < 0 ||
      groupOrder >= groupCount ||
      !Number.isSafeInteger(position) ||
      position < 0 ||
      isUndefined(id) ||
      !REGEX.MONGO_OBJECT_ID.test(id) ||
      !isUndefined(extra)
    ) {
      throw new BadRequestException(DICTIONARY.collection.invalidPagination)
    }

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

  private mapItem(card: IItemCollectionCard): ItemCollectionResponseDto {
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
      membership: {
        groupId: card.groupId.toHexString(),
        position: card.position,
        note: card.note,
      },
    }
  }
}

export { CollectionContentService }
