import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common"

import { AuthService } from "@endpoints/auth/services/authService"
import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { UserRepository } from "@entities/user/services/userRepository"
import { StorageService } from "@infrastructure/storage/services/storageService"
import type { IStorageUploadResult } from "@infrastructure/storage/services/storageService"
import { isNil } from "@shared/functions/checks/isNil"
import { requestContext } from "@shared/functions/context/requestContext"

import type { AccountAvatarResponseDto } from "../dto/accountAvatar.response"

@Injectable()
class AccountAvatarService {
  constructor(
    private readonly authService: AuthService,
    private readonly userRepository: UserRepository,
    private readonly storageService: StorageService,
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

    await this.updateAvatar(userId, { path, publicUrl })

    return { avatarUrl: publicUrl }
  }

  async remove(userId: string) {
    await this.updateAvatar(userId, null)
  }

  private async updateAvatar(
    userId: string,
    avatar: { path: string; publicUrl: string } | null,
  ) {
    const previous = await this.userRepository.write.updateById(
      userId,
      {
        $set: {
          avatarUrl: avatar?.publicUrl ?? null,
          avatarStorageKey: avatar?.path ?? null,
        },
      },
      { returnDocument: "before", projection: { avatarStorageKey: 1 } },
    )

    if (isNil(previous)) {
      throw new UnauthorizedException(DICTIONARY.auth.unauthorized)
    }

    if (!isNil(previous.avatarStorageKey)) {
      await this.storageService
        .delete(previous.avatarStorageKey)
        .catch(() => undefined)
    }
  }
}

export { AccountAvatarService }
