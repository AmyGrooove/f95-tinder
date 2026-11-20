import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
import { Types } from "mongoose"

import { CollectionRepository } from "@entities/collection/services/collectionRepository"
import { ECollectionBlockType } from "@entities/collection/schemas/ECollectionBlockType"
import { ItemCollectionRepository } from "@entities/itemCollection/services/itemCollectionRepository"
import { UserCollectionRepository } from "@entities/userCollection/services/userCollectionRepository"
import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { isNil } from "@shared/functions/checks/isNil"

import type { UserCollectionResponseDto } from "../dto/userCollection.response"
import type { IUpdateCollectionReactionProps } from "../types/IUpdateCollectionReactionProps"
import { CollectionAuthService } from "@endpoints/collection/services/collectionAuthService"

@Injectable()
class CollectionUserService {
  constructor(
    private readonly collectionAuthService: CollectionAuthService,
    private readonly collectionRepository: CollectionRepository,
    private readonly userCollectionRepository: UserCollectionRepository,
    private readonly itemCollectionRepository: ItemCollectionRepository,
  ) {}

  async getUser(
    accessToken: unknown,
    id: Types.ObjectId,
  ): Promise<UserCollectionResponseDto> {
    const userId = await this.collectionAuthService.authenticate(accessToken)
    const collection = await this.collectionRepository.findNotDeletedById(id)

    if (isNil(collection)) {
      throw new NotFoundException(DICTIONARY.collection.notFound)
    }

    const groupIds = collection.blocks
      .filter((block) => block.type === ECollectionBlockType.GROUP)
      .map((block) => block.id)
    const [reaction, progress] = await Promise.all([
      this.userCollectionRepository.findByUserAndCollection(userId, id),
      this.itemCollectionRepository.readAvailableCounts(
        { collectionId: id, groupIds },
        userId,
      ),
    ])

    return {
      isFavorite: reaction?.isFavorite ?? false,
      rating: reaction?.rating ?? null,
      isHidden: reaction?.isHidden ?? false,
      progress,
    }
  }

  async updateReaction(
    accessToken: unknown,
    props: IUpdateCollectionReactionProps,
  ) {
    const { id, reaction: requestedReaction } = props

    const userId = await this.collectionAuthService.authenticate(accessToken)
    const collection =
      await this.collectionRepository.findNotDeletedAuthorById(id)

    if (isNil(collection)) {
      throw new NotFoundException(DICTIONARY.collection.notFound)
    }

    if (
      !isNil(requestedReaction.rating) &&
      !isNil(collection.author) &&
      collection.author.equals(userId)
    ) {
      throw new ConflictException(DICTIONARY.collection.ownRatingForbidden)
    }

    const reaction = await this.userCollectionRepository.upsertReaction({
      userId,
      collectionId: id,
      reaction: requestedReaction,
    })

    if (isNil(reaction)) {
      throw new NotFoundException(DICTIONARY.collection.notFound)
    }
  }
}

export { CollectionUserService }
