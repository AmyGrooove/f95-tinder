import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common"

import { AuthService } from "@endpoints/auth/services/authService"
import { AccountAvatarEventsService } from "@endpoints/account/services/accountAvatarEventsService"
import { EMediaSource } from "@entities/shared/schemas/EMediaSource"
import { EMediaType } from "@entities/shared/schemas/EMediaType"
import type { MediaSrc } from "@entities/shared/schemas/mediaSrc.schema"
import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { UserRepository } from "@entities/user/services/userRepository"
import type { IStorageUploadResult } from "@infrastructure/storage/services/storageService"
import { isNil } from "@shared/functions/checks/isNil"
import { requestContext } from "@shared/functions/context/requestContext"

import type { AccountAvatarResponseDto } from "../dto/accountAvatar.response"

@Injectable()
class AccountAvatarService {
  constructor(
    private readonly authService: AuthService,
    private readonly userRepository: UserRepository,
    private readonly avatarEvents: AccountAvatarEventsService,
  ) {}

  async authenticate(accessToken: unknown) {
    const payload = await this.authService.verifyAccessToken(accessToken)
    const [session, user] = await Promise.all([
      this.authService.getSession(payload),
      this.userRepository.read.findById(payload.sub, { _id: 1 }),
    ])

    if (isNil(session) || isNil(user)) {
      throw new UnauthorizedException(DICTIONARY.auth.unauthorized)
    }

    const userId = user._id.toHexString()
    requestContext.set("userId", userId)

    return userId
  }

  async replace(
    userId: string,
    avatar: IStorageUploadResult,
  ): Promise<AccountAvatarResponseDto> {
    const { path, publicUrl } = avatar

    if (isNil(publicUrl)) {
      throw new ServiceUnavailableException(
        DICTIONARY.account.avatarStorageUnavailable,
      )
    }

    await this.updateAvatar(userId, {
      src: path,
      source: EMediaSource.STORAGE_KEY,
      language: null,
      type: EMediaType.AVATAR,
    })

    return { avatarUrl: publicUrl }
  }

  async remove(userId: string) {
    await this.updateAvatar(userId, null)
  }

  private async updateAvatar(userId: string, avatar: MediaSrc | null) {
    const previous = await this.userRepository.write.updateById(
      userId,
      {
        $set: { avatar },
      },
      { returnDocument: "before", projection: { avatar: 1 } },
    )

    if (isNil(previous)) {
      throw new UnauthorizedException(DICTIONARY.auth.unauthorized)
    }

    await this.avatarEvents.publishChanged(previous.avatar ?? null, avatar)
  }
}

export { AccountAvatarService }
