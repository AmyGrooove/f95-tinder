import { Injectable, NotFoundException } from "@nestjs/common"
import type { Types } from "mongoose"

import { CollectionRepository } from "@entities/collection/services/collection.repository"
import { ECollectionBlockType } from "@entities/collection/schemas/ECollectionBlockType"
import type { CollectionBlock } from "@entities/collection/schemas/collectionBlock.schema"
import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { isNil } from "@shared/functions/checks/isNil"

import type { CollectionResponseDto } from "../dto/response/collection.response"

@Injectable()
class CollectionService {
  constructor(private readonly collectionRepository: CollectionRepository) {}

  async getById(id: Types.ObjectId): Promise<CollectionResponseDto> {
    const collection = await this.collectionRepository.findNotDeletedById(id)

    if (isNil(collection)) {
      throw new NotFoundException(DICTIONARY.collection.notFound)
    }

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
