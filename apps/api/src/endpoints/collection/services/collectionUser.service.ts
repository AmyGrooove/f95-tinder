import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common"
import { Types } from "mongoose"

import { AuthService } from "@endpoints/auth"
import { CollectionRepository } from "@entities/collection/services/collection.repository"
import { UserRepository } from "@entities/user/services/user.repository"
import { UserCollectionRepository } from "@entities/userCollection/services/userCollection.repository"
import type { UserCollection } from "@entities/userCollection/schemas/userCollection.schema"
import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { isNil } from "@shared/functions/checks/isNil"
import { requestContext } from "@shared/functions/context/requestContext"

import type { UserCollectionResponseDto } from "../dto/response/userCollection.response"
import type { IUpdateCollectionReactionProps } from "../types/IUpdateCollectionReactionProps"

@Injectable()
class CollectionUserService {
  constructor(
    private readonly authService: AuthService,
    private readonly userRepository: UserRepository,
    private readonly collectionRepository: CollectionRepository,
    private readonly userCollectionRepository: UserCollectionRepository,
  ) {}

  async getUser(
    accessToken: unknown,
    id: Types.ObjectId,
  ): Promise<UserCollectionResponseDto> {
    const userId = await this.authenticate(accessToken)
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
    const userId = await this.authenticate(accessToken)
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

  private async authenticate(accessToken: unknown) {
    const payload = await this.authService.verifyAccessToken(accessToken)
    const [session, user] = await Promise.all([
      this.authService.getSession(payload),
      this.userRepository.read.findById(payload.sub, { _id: 1 }),
    ])

    if (isNil(session) || isNil(user)) {
      throw new UnauthorizedException(DICTIONARY.auth.unauthorized)
    }

    requestContext.set("userId", payload.sub)

    return user._id
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
