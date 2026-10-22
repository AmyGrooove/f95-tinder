import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common"
import { Types } from "mongoose"
import type { HydratedDocument } from "mongoose"

import { AuthService } from "@endpoints/auth"
import { UserRepository } from "@entities/user/services/user.repository"
import { ItemRepository } from "@entities/item/services/item.repository"
import { CollectionItemRepository } from "@entities/collectionItem/services/collectionItem.repository"
import { CollectionRepository } from "@entities/collection/services/collection.repository"
import type { Collection } from "@entities/collection/schemas/collection.schema"
import { ECollectionBlockType } from "@entities/collection/schemas/ECollectionBlockType"
import type {
  CollectionBlock,
  TCreateCollectionBlock,
} from "@entities/collection/schemas/collectionBlock.schema"
import { checkIsLanguageTextFilled } from "@entities/shared/functions/checkIsLanguageTextFilled"
import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { MongoTransactionService } from "@infrastructure/database/services/mongoTransaction.service"
import { isNil } from "@shared/functions/checks/isNil"
import { isUndefined } from "@shared/functions/checks/isUndefined"
import { requestContext } from "@shared/functions/context/requestContext"

import type { CollectionResponseDto } from "../dto/response/collection.response"
import type { CreateCollectionBodyDto } from "../dto/body/createCollection.body"
import type { CreateBlockBodyDto } from "../dto/body/createBlock.body"
import type { UpdateCollectionBodyDto } from "../dto/body/updateCollection.body"
import type { IUpdateCollectionRequestProps } from "../types/IUpdateCollectionRequestProps"

@Injectable()
class CollectionService {
  constructor(
    private readonly collectionRepository: CollectionRepository,
    private readonly collectionItemRepository: CollectionItemRepository,
    private readonly itemRepository: ItemRepository,
    private readonly userRepository: UserRepository,
    private readonly authService: AuthService,
    private readonly transactionService: MongoTransactionService,
  ) {}

  async create(accessToken: unknown, body: CreateCollectionBodyDto) {
    const payload = await this.authService.verifyAccessToken(accessToken)
    const [session, user] = await Promise.all([
      this.authService.getSession(payload),
      this.userRepository.read.findById(payload.sub, { _id: 1 }),
    ])

    if (isNil(session) || isNil(user)) {
      throw new UnauthorizedException(DICTIONARY.auth.unauthorized)
    }

    requestContext.set("userId", payload.sub)

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
            author: user._id,
            title: body.title,
            description: body.description,
            type: body.type,
            media: body.media,
            blocks,
          },
          { session: transactionSession },
        )

        if (items.length > 0) {
          await this.collectionItemRepository.createForCollection(
            { collectionId: created._id, items },
            { session: transactionSession },
          )
        }

        return created
      },
    )

    return this.mapResponse(collection)
  }

  async getById(id: Types.ObjectId): Promise<CollectionResponseDto> {
    const collection = await this.collectionRepository.findNotDeletedById(id)

    if (isNil(collection)) {
      throw new NotFoundException(DICTIONARY.collection.notFound)
    }

    return this.mapResponse(collection)
  }

  async update(accessToken: unknown, props: IUpdateCollectionRequestProps) {
    const payload = await this.authService.verifyAccessToken(accessToken)
    const [session, user] = await Promise.all([
      this.authService.getSession(payload),
      this.userRepository.read.findById(payload.sub, { _id: 1 }),
    ])

    if (isNil(session) || isNil(user)) {
      throw new UnauthorizedException(DICTIONARY.auth.unauthorized)
    }

    requestContext.set("userId", payload.sub)

    const { id, body } = props
    const isChangeProvided =
      [
        body.title,
        body.description,
        body.media,
        body.type,
        body.blockOrder,
      ].some((value) => !isUndefined(value)) ||
      [
        body.upsertBlocks,
        body.removeBlockIds,
        body.upsertItems,
        body.removeItemIds,
      ].some((values) => !isUndefined(values) && values.length > 0)

    if (!isChangeProvided) {
      throw new BadRequestException(DICTIONARY.collection.emptyUpdate)
    }

    if (!isUndefined(body.title) && !checkIsLanguageTextFilled(body.title)) {
      throw new BadRequestException(DICTIONARY.collection.titleRequired)
    }

    const collection = await this.transactionService.run(
      async (transactionSession) => {
        const current = await this.collectionRepository.findNotDeletedById(id, {
          session: transactionSession,
        })

        if (
          isNil(current) ||
          isNil(current.author) ||
          !current.author.equals(user._id)
        ) {
          throw new NotFoundException(DICTIONARY.collection.notFound)
        }

        if (current.version !== body.version) {
          throw new ConflictException(DICTIONARY.collection.versionConflict)
        }

        if (current.version === Number.MAX_SAFE_INTEGER) {
          throw new ConflictException(DICTIONARY.collection.versionLimit)
        }

        const blocks = this.prepareUpdatedBlocks(current.blocks, body)
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
        const removeItemIds = this.normalizeUniqueIds(
          body.removeItemIds ?? [],
          DICTIONARY.collection.invalidItemChanges,
        ).map((itemId) => new Types.ObjectId(itemId))
        const removedItemIds = new Set(
          removeItemIds.map((itemId) => itemId.toHexString()),
        )
        const items = (body.upsertItems ?? []).map((item) => ({
          item: new Types.ObjectId(item.itemId),
          groupId: new Types.ObjectId(item.groupId),
          position: item.position,
          note: item.note,
        }))
        const itemIds = items.map((item) => item.item.toHexString())

        if (
          new Set(itemIds).size !== itemIds.length ||
          itemIds.some((itemId) => removedItemIds.has(itemId))
        ) {
          throw new BadRequestException(
            DICTIONARY.collection.invalidItemChanges,
          )
        }

        if (items.some((item) => !groupIds.has(item.groupId.toHexString()))) {
          throw new BadRequestException(DICTIONARY.collection.invalidGroup)
        }

        if (removeItemIds.length > 0) {
          const memberships =
            await this.collectionItemRepository.findByCollectionAndItems(
              { collectionId: id, itemIds: removeItemIds },
              { session: transactionSession },
            )

          if (memberships.length !== removeItemIds.length) {
            throw new BadRequestException(
              DICTIONARY.collection.membershipNotFound,
            )
          }
        }

        if (items.length > 0) {
          const existingItems = await this.itemRepository.findNotDeletedByIds(
            items.map((item) => item.item),
            { session: transactionSession },
          )

          if (existingItems.length !== items.length) {
            throw new NotFoundException(DICTIONARY.collection.itemNotFound)
          }
        }

        const updated = await this.collectionRepository.updateVersioned(
          {
            id,
            authorId: user._id,
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
          await this.collectionItemRepository.upsertForCollection(
            { collectionId: id, items },
            { session: transactionSession },
          )
        }

        if (removeItemIds.length > 0 || removedGroupIds.length > 0) {
          await this.collectionItemRepository.removeForCollection(
            {
              collectionId: id,
              itemIds: removeItemIds,
              groupIds: removedGroupIds,
            },
            { session: transactionSession },
          )
        }

        return updated
      },
    )

    return this.mapResponse(collection)
  }

  async remove(accessToken: unknown, id: Types.ObjectId) {
    const payload = await this.authService.verifyAccessToken(accessToken)
    const [session, user] = await Promise.all([
      this.authService.getSession(payload),
      this.userRepository.read.findById(payload.sub, { _id: 1 }),
    ])

    if (isNil(session) || isNil(user)) {
      throw new UnauthorizedException(DICTIONARY.auth.unauthorized)
    }

    requestContext.set("userId", payload.sub)

    const collection = await this.collectionRepository.softDeleteByAuthor(
      id,
      user._id,
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

  private prepareUpdatedBlocks(
    current: CollectionBlock[],
    body: UpdateCollectionBodyDto,
  ) {
    const blocks = new Map(
      current.map((block) => [block.id.toHexString(), block]),
    )
    const removedIds = new Set(
      this.normalizeUniqueIds(
        body.removeBlockIds ?? [],
        DICTIONARY.collection.invalidBlockChanges,
      ),
    )
    const upserts = (body.upsertBlocks ?? []).map((block) =>
      this.prepareBlock(block),
    )
    const upsertIds = upserts.map((block) => block.id.toHexString())

    if (
      new Set(upsertIds).size !== upsertIds.length ||
      upsertIds.some((id) => removedIds.has(id))
    ) {
      throw new BadRequestException(DICTIONARY.collection.invalidBlockChanges)
    }

    for (const id of removedIds) {
      if (!blocks.delete(id)) {
        throw new BadRequestException(DICTIONARY.collection.blockNotFound)
      }
    }

    for (const block of upserts) {
      const id = block.id.toHexString()
      const existing = blocks.get(id)

      if (!isNil(existing) && existing.type !== block.type) {
        throw new BadRequestException(DICTIONARY.collection.blockTypeChange)
      }

      blocks.set(id, {
        id: block.id,
        type: block.type,
        title: block.title ?? null,
        description: block.description ?? null,
        content: block.content ?? null,
      })
    }

    if (isUndefined(body.blockOrder)) {
      return [...blocks.values()]
    }

    const order = this.normalizeUniqueIds(
      body.blockOrder,
      DICTIONARY.collection.invalidBlockOrder,
    )

    if (order.length !== blocks.size) {
      throw new BadRequestException(DICTIONARY.collection.invalidBlockOrder)
    }

    return order.map((id) => {
      const block = blocks.get(id)

      if (isNil(block)) {
        throw new BadRequestException(DICTIONARY.collection.invalidBlockOrder)
      }

      return block
    })
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
  ): CollectionResponseDto {
    return {
      id: collection._id.toHexString(),
      version: collection.version,
      authorId: collection.author?.toHexString() ?? null,
      type: collection.type,
      title: collection.title,
      description: collection.description,
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
        title: block.title,
        description: block.description,
      }
    }

    return {
      id,
      type: ECollectionBlockType.TEXT,
      content: block.content ?? { ru: null, en: null },
    }
  }
}

export { CollectionService }
