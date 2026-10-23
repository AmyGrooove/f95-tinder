import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
import { Types } from "mongoose"

import { CollectionRepository } from "@entities/collection/services/collection.repository"
import { UserCollectionRepository } from "@entities/userCollection/services/userCollection.repository"
import type { UserCollection } from "@entities/userCollection/schemas/userCollection.schema"
import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { isNil } from "@shared/functions/checks/isNil"

import type { UserCollectionResponseDto } from "../dto/response/userCollection.response"
import type { IUpdateCollectionReactionProps } from "../types/IUpdateCollectionReactionProps"
import { CollectionAuthService } from "./collectionAuth.service"

@Injectable()
class CollectionUserService {
  constructor(
    private readonly collectionAuthService: CollectionAuthService,
    private readonly collectionRepository: CollectionRepository,
    private readonly userCollectionRepository: UserCollectionRepository,
  ) {}

  async getUser(
    accessToken: unknown,
    id: Types.ObjectId,
  ): Promise<UserCollectionResponseDto> {
    const userId = await this.collectionAuthService.authenticate(accessToken)
    const isAvailable = await this.collectionRepository.checkIsNotDeleted(id)

    if (!isAvailable) {
      throw new NotFoundException(DICTIONARY.collection.notFound)
    }

    const reaction =
      await this.userCollectionRepository.findByUserAndCollection(userId, id)

    return this.mapResponse(reaction)
  }

  async updateReaction(
    accessToken: unknown,
    props: IUpdateCollectionReactionProps,
  ): Promise<UserCollectionResponseDto> {
    const userId = await this.collectionAuthService.authenticate(accessToken)
    const collection = await this.collectionRepository.findNotDeletedAuthorById(
      props.id,
    )

    if (isNil(collection)) {
      throw new NotFoundException(DICTIONARY.collection.notFound)
    }

    if (
      !isNil(props.reaction.rating) &&
      !isNil(collection.author) &&
      collection.author.equals(userId)
    ) {
      throw new ConflictException(DICTIONARY.collection.ownRatingForbidden)
    }

    const reaction = await this.userCollectionRepository.upsertReaction({
      userId,
      collectionId: props.id,
      reaction: props.reaction,
    })

    if (isNil(reaction)) {
      throw new NotFoundException(DICTIONARY.collection.notFound)
    }

    return this.mapResponse(reaction)
  }

  private mapResponse(
    reaction: Pick<UserCollection, "isFavorite" | "rating" | "isHidden"> | null,
  ): UserCollectionResponseDto {
    return {
      isFavorite: reaction?.isFavorite ?? false,
      rating: reaction?.rating ?? null,
      isHidden: reaction?.isHidden ?? false,
    }
  }
}

export { CollectionUserService }
