import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common"
import { Types } from "mongoose"

import { AuthService } from "@endpoints/auth"
import { CollectionRepository } from "@entities/collection/services/collection.repository"
import { UserRepository } from "@entities/user/services/user.repository"
import { UserCollectionRepository } from "@entities/userCollection/services/userCollection.repository"
import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { isNil } from "@shared/functions/checks/isNil"
import { requestContext } from "@shared/functions/context/requestContext"

import type { UserCollectionResponseDto } from "../dto/response/userCollection.response"

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
    const payload = await this.authService.verifyAccessToken(accessToken)
    const [session, user] = await Promise.all([
      this.authService.getSession(payload),
      this.userRepository.read.findById(payload.sub, { _id: 1 }),
    ])

    if (isNil(session) || isNil(user)) {
      throw new UnauthorizedException(DICTIONARY.auth.unauthorized)
    }

    requestContext.set("userId", payload.sub)

    const isAvailable = await this.collectionRepository.checkIsNotDeleted(id)

    if (!isAvailable) {
      throw new NotFoundException(DICTIONARY.collection.notFound)
    }

    const reaction =
      await this.userCollectionRepository.findByUserAndCollection(user._id, id)

    return {
      isFavorite: reaction?.isFavorite ?? false,
      rating: reaction?.rating ?? null,
      isHidden: reaction?.isHidden ?? false,
    }
  }
}

export { CollectionUserService }
