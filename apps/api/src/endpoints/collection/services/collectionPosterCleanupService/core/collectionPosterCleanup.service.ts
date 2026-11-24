import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common"

import { CollectionPosterEventsService } from "@endpoints/collection/services/collectionPosterEventsService"
import { EMediaSource } from "@entities/shared/schemas/EMediaSource"
import { StorageService } from "@infrastructure/storage/services/storageService"

@Injectable()
class CollectionPosterCleanupService implements OnModuleInit, OnModuleDestroy {
  private unsubscribe?: () => void

  constructor(
    private readonly posterEvents: CollectionPosterEventsService,
    private readonly storageService: StorageService,
  ) {}

  onModuleInit() {
    this.unsubscribe = this.posterEvents.subscribe(
      async ({ collectionId, previousPosters, currentKey }) => {
        const prefix = `collections/${collectionId}/poster/`

        for (const poster of previousPosters) {
          const filename = poster.src.slice(poster.src.lastIndexOf("/") + 1)
          const key = prefix + filename
          const isStoredPoster =
            poster.source === EMediaSource.STORAGE_KEY
              ? poster.src === key
              : poster.src.endsWith("/" + key)

          if (
            isStoredPoster &&
            key !== currentKey &&
            /^[a-f0-9-]{36}\.webp$/.test(filename)
          ) {
            await this.storageService.delete(key).catch(() => undefined)
          }
        }
      },
    )
  }

  onModuleDestroy() {
    this.unsubscribe?.()
  }
}

export { CollectionPosterCleanupService }
