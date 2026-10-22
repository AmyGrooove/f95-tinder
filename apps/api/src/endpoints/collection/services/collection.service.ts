import {
  BadRequestException,
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

  private prepareBlock(block: CreateBlockBodyDto): TCreateCollectionBlock {
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
