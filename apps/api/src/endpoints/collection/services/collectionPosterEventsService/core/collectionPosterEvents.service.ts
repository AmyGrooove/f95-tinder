import { Injectable, Logger } from "@nestjs/common"

import type { MediaSrc } from "@entities/shared/schemas/mediaSrc.schema"

interface ICollectionPosterChanged {
  collectionId: string
  previousPosters: readonly MediaSrc[]
  currentKey: string
}

@Injectable()
class CollectionPosterEventsService {
  private readonly logger = new Logger(CollectionPosterEventsService.name)
  private readonly listeners = new Set<
    (event: ICollectionPosterChanged) => Promise<void>
  >()

  subscribe(listener: (event: ICollectionPosterChanged) => Promise<void>) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async publishChanged(event: ICollectionPosterChanged) {
    for (const listener of this.listeners) {
      try {
        await listener(event)
      } catch (error) {
        this.logger.error("Collection poster change listener failed", error)
      }
    }
  }
}

export { CollectionPosterEventsService }
