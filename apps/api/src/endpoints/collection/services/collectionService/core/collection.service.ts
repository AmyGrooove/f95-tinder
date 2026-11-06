import { ELanguage } from "@entities/shared/schemas/ELanguage"
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common"
import { Types } from "mongoose"
import type { ClientSession, HydratedDocument } from "mongoose"

import { EMediaType } from "@entities/shared/schemas/EMediaType"
import { StorageService } from "@infrastructure/storage/services/storageService"
import { UserRepository } from "@entities/user/services/userRepository"
import { ItemRepository } from "@entities/item/services/itemRepository"
import { ItemCollectionRepository } from "@entities/itemCollection/services/itemCollectionRepository"
import { CollectionRepository } from "@entities/collection/services/collectionRepository"
import type { Collection } from "@entities/collection/schemas/collection.schema"
import { ECollectionBlockType } from "@entities/collection/schemas/ECollectionBlockType"
import type {
  CollectionBlock,
  TCreateCollectionBlock,
} from "@entities/collection/schemas/collectionBlock.schema"
import { checkIsLanguageTextFilled } from "@entities/shared/functions/checkIsLanguageTextFilled"
import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { MongoTransactionService } from "@infrastructure/database/services/mongoTransactionService"
import { isNil } from "@shared/functions/checks/isNil"
import { isUndefined } from "@shared/functions/checks/isUndefined"

import type { CollectionResponseDto } from "../dto/collection.response"
import type { CreateCollectionBodyDto } from "../dto/createCollection.body"
import type { CreateBlockBodyDto } from "../dto/createBlock.body"
import type { UpdateCollectionBodyDto } from "../dto/updateCollection.body"
import type { IUpdateCollectionRequestProps } from "../types/IUpdateCollectionRequestProps"
import { CollectionAuthService } from "@endpoints/collection/services/collectionAuthService"
import type { IPrepareItemChangesProps } from "../types/IPrepareItemChangesProps"
import type { IReplacePosterProps } from "../types/IReplacePosterProps"

@Injectable()
class CollectionService {
  constructor(
    private readonly collectionRepository: CollectionRepository,
    private readonly itemCollectionRepository: ItemCollectionRepository,
    private readonly itemRepository: ItemRepository,
    private readonly collectionAuthService: CollectionAuthService,
    private readonly transactionService: MongoTransactionService,
    private readonly userRepository: UserRepository,
    private readonly storageService: StorageService,
  ) {}

  async create(accessToken: unknown, body: CreateCollectionBodyDto) {
    const userId = await this.collectionAuthService.authenticate(accessToken)

    if (!checkIsLanguageTextFilled(body.title)) {
      throw new BadRequestException(DICTIONARY.collection.titleRequired)
    }

    const blocks = (body.blocks ?? []).map((block) => this.prepareBlock(block))
    const blockIds = blocks.map((block) => String(block.id))

    if (new Set(blockIds).size !== blockIds.length) {
      throw new BadRequestException(DICTIONARY.collection.duplicateBlocks)
    }

    const groupIds = new Set(
      blocks
        .filter((block) => block.type === ECollectionBlockType.GROUP)
        .map((block) => String(block.id)),
    )
    const items = (body.items ?? []).map((item) => ({
      item: new Types.ObjectId(item.itemId),
      groupId: new Types.ObjectId(item.groupId),
      position: item.position,
      note: item.note ?? null,
    }))

    if (
      new Set(items.map((item) => item.item.toHexString())).size !==
      items.length
    ) {
      throw new BadRequestException(DICTIONARY.collection.duplicateItems)
    }

    if (items.some((item) => !groupIds.has(item.groupId.toHexString()))) {
      throw new BadRequestException(DICTIONARY.collection.invalidGroup)
    }

    const collection = await this.transactionService.run(
      async (transactionSession) => {
        if (items.length > 0) {
          const existingItems = await this.itemRepository.findNotDeletedByIds(
            items.map((item) => item.item),
            { session: transactionSession },
          )

          if (existingItems.length !== items.length) {
            throw new NotFoundException(DICTIONARY.collection.itemNotFound)
          }
        }

        const created = await this.collectionRepository.write.create(
          {
            author: userId,
            title: body.title,
            description: body.description,
            type: body.type,
            media: [],
            blocks,
          },
          { session: transactionSession },
        )

        if (items.length > 0) {
          await this.itemCollectionRepository.createForCollection(
            { collectionId: created._id, items },
            { session: transactionSession },
          )
        }

        return created
      },
    )

    return { id: collection._id.toHexString() }
  }

  async getById(id: Types.ObjectId): Promise<CollectionResponseDto> {
    const collection = await this.collectionRepository.findNotDeletedById(id)

    if (isNil(collection)) {
      throw new NotFoundException(DICTIONARY.collection.notFound)
    }

    const user = isNil(collection.author)
      ? null
      : await this.userRepository.read.findById(
          collection.author.toHexString(),
          {
            _id: 1,
            avatarUrl: 1,
            displayName: 1,
          },
        )

    return this.mapResponse(
      collection,
      isNil(user)
        ? null
        : {
            id: user._id.toHexString(),
            avatar: user.avatarUrl ?? null,
            displayName: user.displayName,
          },
    )
  }

  async update(accessToken: unknown, props: IUpdateCollectionRequestProps) {
    const userId = await this.collectionAuthService.authenticate(accessToken)

    const { id, body } = props
    const isChangeProvided =
      [body.title, body.description, body.media, body.type].some(
        (value) => !isUndefined(value),
      ) ||
      [body.blocks, body.items].some(
        (operations) =>
          !isUndefined(operations) &&
          [
            operations.add,
            operations.update,
            operations.move,
            operations.remove,
          ].some((entries) => (entries?.length ?? 0) > 0),
      )

    if (!isChangeProvided) {
      throw new BadRequestException(DICTIONARY.collection.emptyUpdate)
    }

    if (!isUndefined(body.title) && !checkIsLanguageTextFilled(body.title)) {
      throw new BadRequestException(DICTIONARY.collection.titleRequired)
    }

    await this.transactionService.run(async (transactionSession) => {
      const current = await this.collectionRepository.findNotDeletedById(id, {
        session: transactionSession,
      })

      if (
        isNil(current) ||
        isNil(current.author) ||
        !current.author.equals(userId)
      ) {
        throw new NotFoundException(DICTIONARY.collection.notFound)
      }

      if (current.version !== body.version) {
        throw new ConflictException(DICTIONARY.collection.versionConflict)
      }

      if (current.version === Number.MAX_SAFE_INTEGER) {
        throw new ConflictException(DICTIONARY.collection.versionLimit)
      }

      const blocks = this.prepareUpdatedBlocks(current.blocks, body.blocks)
      const groupIds = new Set(
        blocks
          .filter((block) => block.type === ECollectionBlockType.GROUP)
          .map((block) => block.id.toHexString()),
      )
      const removedGroupIds = current.blocks
        .filter(
          (block) =>
            block.type === ECollectionBlockType.GROUP &&
            !groupIds.has(block.id.toHexString()),
        )
        .map((block) => block.id)
      const { items, removeItemIds } = await this.prepareItemChanges(
        { id, changes: body.items, groupIds },
        transactionSession,
      )

      const updated = await this.collectionRepository.updateVersioned(
        {
          id,
          authorId: userId,
          version: body.version,
          changes: {
            title: body.title ?? current.title,
            description: body.description ?? current.description,
            media: body.media ?? current.media,
            type: body.type ?? current.type,
            blocks,
          },
        },
        { session: transactionSession },
      )

      if (isNil(updated)) {
        throw new ConflictException(DICTIONARY.collection.versionConflict)
      }

      if (items.length > 0) {
        await this.itemCollectionRepository.upsertForCollection(
          { collectionId: id, items },
          { session: transactionSession },
        )
      }

      if (removeItemIds.length > 0 || removedGroupIds.length > 0) {
        await this.itemCollectionRepository.removeForCollection(
          {
            collectionId: id,
            itemIds: removeItemIds,
            groupIds: removedGroupIds,
          },
          { session: transactionSession },
        )
      }
    })
  }

  async getOwnedCollection(accessToken: unknown, id: Types.ObjectId) {
    const userId = await this.collectionAuthService.authenticate(accessToken)
    const collection = await this.collectionRepository.findNotDeletedById(id)
    if (
      isNil(collection) ||
      isNil(collection.author) ||
      !collection.author.equals(userId)
    ) {
      throw new NotFoundException(DICTIONARY.collection.notFound)
    }
    return { collection, userId }
  }

  async replacePoster(accessToken: unknown, props: IReplacePosterProps) {
    const { id } = props

    const { collection, userId } = await this.getOwnedCollection(
      accessToken,
      id,
    )
    const { src } = props

    if (isNil(src)) {
      throw new ServiceUnavailableException(
        "Публичный адрес хранилища недоступен",
      )
    }
    if (collection.version === Number.MAX_SAFE_INTEGER) {
      throw new ConflictException(DICTIONARY.collection.versionLimit)
    }
    const updated = await this.collectionRepository.updateVersioned({
      id: id,
      authorId: userId,
      version: collection.version,
      changes: {
        title: collection.title,
        description: collection.description,
        type: collection.type,
        blocks: collection.blocks,
        media: [
          { src: src, language: null, type: EMediaType.POSTER },
          ...collection.media.filter(
            (media) => media.type !== EMediaType.POSTER,
          ),
        ],
      },
    })
    if (isNil(updated)) {
      throw new ConflictException(DICTIONARY.collection.versionConflict)
    }
    const prefix = "collections/" + id.toHexString() + "/poster/"
    for (const poster of collection.media.filter(
      (media) => media.type === EMediaType.POSTER,
    )) {
      const key = poster.src.slice(poster.src.lastIndexOf("/") + 1)
      if (
        poster.src.endsWith("/" + prefix + key) &&
        /^[a-f0-9-]{36}\.webp$/.test(key)
      ) {
        await this.storageService.delete(prefix + key).catch(() => undefined)
      }
    }
  }

  async remove(accessToken: unknown, id: Types.ObjectId) {
    const userId = await this.collectionAuthService.authenticate(accessToken)

    const collection = await this.collectionRepository.softDeleteByAuthor(
      id,
      userId,
    )

    if (isNil(collection)) {
      throw new NotFoundException(DICTIONARY.collection.notFound)
    }
  }

  private normalizeUniqueIds(ids: string[], message: string) {
    const normalized = ids.map((id) => new Types.ObjectId(id).toHexString())

    if (new Set(normalized).size !== normalized.length) {
      throw new BadRequestException(message)
    }

    return normalized
  }

  private insertBefore(
    order: string[],
    id: string,
    before: string | null | undefined,
    message: string,
  ) {
    const current = order.indexOf(id)
    if (current >= 0) {
      order.splice(current, 1)
    }

    const index = isNil(before)
      ? order.length
      : order.indexOf(before.toLowerCase())
    if (index < 0) {
      throw new BadRequestException(message)
    }

    order.splice(index, 0, id)
  }

  private prepareUpdatedBlocks(
    current: CollectionBlock[],
    changes: UpdateCollectionBodyDto["blocks"],
  ) {
    if (isUndefined(changes)) {
      return current
    }

    const invalid = DICTIONARY.collection.invalidBlockChanges
    const removed = new Set(
      this.normalizeUniqueIds(changes.remove ?? [], invalid),
    )
    const blocks = new Map(
      current.map((block) => [block.id.toHexString(), block]),
    )

    for (const id of removed) {
      if (!blocks.delete(id)) {
        throw new BadRequestException(DICTIONARY.collection.blockNotFound)
      }
    }

    const order = [...blocks.keys()]
    this.normalizeUniqueIds(
      (changes.add ?? []).map((block) => block.id),
      invalid,
    )
    for (const input of changes.add ?? []) {
      const id = input.id.toLowerCase()
      if (blocks.has(id) || removed.has(id)) {
        throw new BadRequestException(invalid)
      }

      const block = this.prepareBlock(input)
      blocks.set(id, {
        id: block.id,
        type: block.type,
        title: block.title ?? null,
        description: block.description ?? null,
        content: block.content ?? null,
      })
      this.insertBefore(
        order,
        id,
        input.beforeBlockId,
        DICTIONARY.collection.invalidBlockOrder,
      )
    }

    this.normalizeUniqueIds(
      (changes.update ?? []).map((block) => block.id),
      invalid,
    )
    for (const { id: rawId, title, description, content } of changes.update ??
      []) {
      const id = rawId.toLowerCase()
      const currentBlock = blocks.get(id)
      if (isUndefined(currentBlock)) {
        throw new BadRequestException(DICTIONARY.collection.blockNotFound)
      }
      if ([title, description, content].every(isUndefined)) {
        throw new BadRequestException(invalid)
      }

      const fields =
        currentBlock.type === ECollectionBlockType.GROUP
          ? {
              title: isUndefined(title) ? currentBlock.title : title,
              description: isUndefined(description)
                ? currentBlock.description
                : description,
              content,
            }
          : {
              title,
              description,
              content: content ?? currentBlock.content ?? undefined,
            }
      const block = this.prepareBlock({
        id,
        type: currentBlock.type,
        ...fields,
      })
      blocks.set(id, {
        id: block.id,
        type: block.type,
        title: block.title ?? null,
        description: block.description ?? null,
        content: block.content ?? null,
      })
    }

    this.normalizeUniqueIds(
      (changes.move ?? []).map((block) => block.id),
      invalid,
    )
    for (const move of changes.move ?? []) {
      const id = move.id.toLowerCase()
      if (!blocks.has(id)) {
        throw new BadRequestException(DICTIONARY.collection.blockNotFound)
      }
      this.insertBefore(
        order,
        id,
        move.beforeBlockId,
        DICTIONARY.collection.invalidBlockOrder,
      )
    }

    return order.flatMap((id) => {
      const block = blocks.get(id)
      return isUndefined(block) ? [] : [block]
    })
  }

  private async prepareItemChanges(
    props: IPrepareItemChangesProps,
    session: ClientSession,
  ) {
    const { id, changes, groupIds } = props
    const additions = changes?.add ?? []
    const updates = changes?.update ?? []
    const moves = changes?.move ?? []
    const invalid = DICTIONARY.collection.invalidItemChanges
    const removed = new Set(
      this.normalizeUniqueIds(changes?.remove ?? [], invalid),
    )
    if (additions.length + updates.length + moves.length + removed.size === 0) {
      return { items: [], removeItemIds: [] }
    }

    const addIds = this.normalizeUniqueIds(
      additions.map((item) => item.itemId),
      invalid,
    )
    const updateIds = this.normalizeUniqueIds(
      updates.map((item) => item.itemId),
      invalid,
    )
    const moveIds = this.normalizeUniqueIds(
      moves.map((item) => item.itemId),
      invalid,
    )
    const touchedIds = [...new Set([...addIds, ...updateIds, ...moveIds])]
    if (touchedIds.some((itemId) => removed.has(itemId))) {
      throw new BadRequestException(invalid)
    }

    const destinations = new Set(
      [...additions, ...moves].map((item) => item.groupId.toLowerCase()),
    )
    for (const groupId of destinations) {
      if (!groupIds.has(groupId)) {
        throw new BadRequestException(DICTIONARY.collection.invalidGroup)
      }
    }

    const removeItemIds = [...removed].map(
      (itemId) => new Types.ObjectId(itemId),
    )
    const current = await this.itemCollectionRepository.read.findMany(
      {
        collectionId: id,
        $or: [
          {
            item: {
              $in: [
                ...touchedIds.map((itemId) => new Types.ObjectId(itemId)),
                ...removeItemIds,
              ],
            },
          },
          {
            groupId: {
              $in: [...destinations].map(
                (groupId) => new Types.ObjectId(groupId),
              ),
            },
          },
        ],
      },
      { item: 1, groupId: 1, position: 1, note: 1 },
      { session, sort: { position: 1, _id: 1 } },
    )
    const original = new Map(
      current.map((member) => [member.item.toHexString(), member]),
    )
    if ([...removed].some((itemId) => !original.has(itemId))) {
      throw new BadRequestException(DICTIONARY.collection.membershipNotFound)
    }
    if (addIds.some((itemId) => original.has(itemId))) {
      throw new BadRequestException(invalid)
    }

    const newItems = addIds.map((itemId) => new Types.ObjectId(itemId))
    if (
      newItems.length > 0 &&
      (await this.itemRepository.findNotDeletedByIds(newItems, { session }))
        .length !== newItems.length
    ) {
      throw new NotFoundException(DICTIONARY.collection.itemNotFound)
    }

    const members = new Map(
      current.map((member) => [
        member.item.toHexString(),
        {
          item: member.item,
          groupId: member.groupId,
          position: member.position,
          note: member.note,
        },
      ]),
    )
    const orders = new Map(
      [...destinations].map((groupId) => [groupId, [] as string[]]),
    )
    for (const member of current) {
      const itemId = member.item.toHexString()
      if (!removed.has(itemId)) {
        orders.get(member.groupId.toHexString())?.push(itemId)
      }
    }

    for (const add of additions) {
      const itemId = add.itemId.toLowerCase()
      const groupId = add.groupId.toLowerCase()
      const order = orders.get(groupId) ?? []
      this.insertBefore(order, itemId, add.beforeItemId, invalid)
      members.set(itemId, {
        item: new Types.ObjectId(itemId),
        groupId: new Types.ObjectId(groupId),
        position: 0,
        note: add.note ?? null,
      })
    }

    for (const update of updates) {
      const member = members.get(update.itemId.toLowerCase())
      if (isUndefined(member)) {
        throw new BadRequestException(DICTIONARY.collection.membershipNotFound)
      }
      member.note = update.note
    }

    for (const move of moves) {
      const itemId = move.itemId.toLowerCase()
      const member = members.get(itemId)
      if (isUndefined(member)) {
        throw new BadRequestException(DICTIONARY.collection.membershipNotFound)
      }

      const groupId = move.groupId.toLowerCase()
      const source = orders.get(member.groupId.toHexString())
      const index = source?.indexOf(itemId) ?? -1
      if (index >= 0) {
        source?.splice(index, 1)
      }
      const destination = orders.get(groupId) ?? []
      this.insertBefore(destination, itemId, move.beforeItemId, invalid)
      member.groupId = new Types.ObjectId(groupId)
    }

    for (const order of orders.values()) {
      order.forEach((itemId, position) => {
        const member = members.get(itemId)
        if (!isUndefined(member)) {
          member.position = position
        }
      })
    }

    if (
      updates.some((update) => {
        const member = members.get(update.itemId.toLowerCase())
        return (
          !isUndefined(member) && !groupIds.has(member.groupId.toHexString())
        )
      })
    ) {
      throw new BadRequestException(invalid)
    }

    const items = [...members.values()].flatMap((member) => {
      const itemId = member.item.toHexString()
      const previous = original.get(itemId)
      if (removed.has(itemId) || !groupIds.has(member.groupId.toHexString())) {
        return []
      }

      const note = previous?.note === member.note ? undefined : member.note
      if (
        !isUndefined(previous) &&
        previous.groupId.equals(member.groupId) &&
        previous.position === member.position &&
        isUndefined(note)
      ) {
        return []
      }

      return [{ ...member, note }]
    })

    return { items, removeItemIds }
  }

  private prepareBlock(
    block: CreateBlockBodyDto,
  ): TCreateCollectionBlock & Pick<CollectionBlock, "id"> {
    const id = isUndefined(block.id)
      ? new Types.ObjectId()
      : new Types.ObjectId(block.id)

    if (block.type === ECollectionBlockType.GROUP) {
      if (!isUndefined(block.content)) {
        throw new BadRequestException(DICTIONARY.collection.groupContent)
      }

      if (!isNil(block.title) && !checkIsLanguageTextFilled(block.title)) {
        throw new BadRequestException(DICTIONARY.collection.groupTitleRequired)
      }

      return {
        id,
        type: ECollectionBlockType.GROUP,
        title: block.title,
        description: block.description,
      }
    }

    if (!isUndefined(block.title) || !isUndefined(block.description)) {
      throw new BadRequestException(DICTIONARY.collection.textGroupFields)
    }

    if (isNil(block.content) || !checkIsLanguageTextFilled(block.content)) {
      throw new BadRequestException(DICTIONARY.collection.textContentRequired)
    }

    return { id, type: ECollectionBlockType.TEXT, content: block.content }
  }

  private mapResponse(
    collection: HydratedDocument<Collection>,
    author: CollectionResponseDto["author"],
  ): CollectionResponseDto {
    return {
      id: collection._id.toHexString(),
      version: collection.version,
      author,
      type: collection.type,
      title: {
        [ELanguage.RUSSIAN]: collection.title[ELanguage.RUSSIAN],
        [ELanguage.ENGLISH]: collection.title[ELanguage.ENGLISH],
      },
      description: {
        [ELanguage.RUSSIAN]: collection.description[ELanguage.RUSSIAN],
        [ELanguage.ENGLISH]: collection.description[ELanguage.ENGLISH],
      },
      media: collection.media.map((media) => ({
        src: media.src,
        language: media.language,
        type: media.type,
      })),
      blocks: collection.blocks.map((block) => this.mapBlock(block)),
      createdAt: collection.createdAt.toISOString(),
      updatedAt: collection.updatedAt.toISOString(),
    }
  }

  private mapBlock(
    block: CollectionBlock,
  ): CollectionResponseDto["blocks"][number] {
    const id = block.id.toHexString()

    if (block.type === ECollectionBlockType.GROUP) {
      return {
        id,
        type: ECollectionBlockType.GROUP,
        title: isNil(block.title)
          ? null
          : {
              [ELanguage.RUSSIAN]: block.title[ELanguage.RUSSIAN],
              [ELanguage.ENGLISH]: block.title[ELanguage.ENGLISH],
            },
        description: isNil(block.description)
          ? null
          : {
              [ELanguage.RUSSIAN]: block.description[ELanguage.RUSSIAN],
              [ELanguage.ENGLISH]: block.description[ELanguage.ENGLISH],
            },
      }
    }

    return {
      id,
      type: ECollectionBlockType.TEXT,
      content: {
        [ELanguage.RUSSIAN]: block.content?.[ELanguage.RUSSIAN] ?? null,
        [ELanguage.ENGLISH]: block.content?.[ELanguage.ENGLISH] ?? null,
      },
    }
  }
}

export { CollectionService }
