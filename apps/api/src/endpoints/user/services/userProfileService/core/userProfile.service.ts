import { Injectable, NotFoundException } from "@nestjs/common"
import type { Types } from "mongoose"

import { resolveMediaUrl } from "@endpoints/shared/functions/resolveMediaUrl"
import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { UserRepository } from "@entities/user/services/userRepository"
import { UserItemRepository } from "@entities/userItem/services/userItemRepository"
import { StorageService } from "@infrastructure/storage/services/storageService"
import { isNil } from "@shared/functions/checks/isNil"

import type { UserProfileResponseDto } from "../dto/userProfile.response"

@Injectable()
class UserProfileService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly userItemRepository: UserItemRepository,
    private readonly storageService: StorageService,
  ) {}

  async readProfile(id: Types.ObjectId): Promise<UserProfileResponseDto> {
    const user = await this.userRepository.read.findById(id.toHexString(), {
      _id: 1,
      username: 1,
      displayName: 1,
      avatar: 1,
      createdAt: 1,
    })

    if (isNil(user)) {
      throw new NotFoundException(DICTIONARY.user.library.notFound)
    }

    const summary = await this.userItemRepository.readLibrarySummary(user._id)

    return {
      id: user._id.toHexString(),
      username: user.username,
      displayName: user.displayName,
      avatarUrl: resolveMediaUrl(user.avatar, this.storageService) ?? null,
      createdAt: user.createdAt.toISOString(),
      summary,
    }
  }
}

export { UserProfileService }
