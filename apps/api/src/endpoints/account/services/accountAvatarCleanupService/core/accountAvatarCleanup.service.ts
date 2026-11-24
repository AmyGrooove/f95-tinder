import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common"

import { AccountAvatarEventsService } from "@endpoints/account/services/accountAvatarEventsService"
import { EMediaSource } from "@entities/shared/schemas/EMediaSource"
import { StorageService } from "@infrastructure/storage/services/storageService"

@Injectable()
class AccountAvatarCleanupService implements OnModuleInit, OnModuleDestroy {
  private unsubscribe?: () => void

  constructor(
    private readonly avatarEvents: AccountAvatarEventsService,
    private readonly storageService: StorageService,
  ) {}

  onModuleInit() {
    this.unsubscribe = this.avatarEvents.subscribe(
      async (previous, current) => {
        if (
          previous?.source === EMediaSource.STORAGE_KEY &&
          (current?.source !== EMediaSource.STORAGE_KEY ||
            previous.src !== current.src)
        ) {
          await this.storageService.delete(previous.src).catch(() => undefined)
        }
      },
    )
  }

  onModuleDestroy() {
    this.unsubscribe?.()
  }
}

export { AccountAvatarCleanupService }
