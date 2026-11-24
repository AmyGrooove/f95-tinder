import { Injectable, Logger } from "@nestjs/common"

import type { MediaSrc } from "@entities/shared/schemas/mediaSrc.schema"

@Injectable()
class AccountAvatarEventsService {
  private readonly logger = new Logger(AccountAvatarEventsService.name)
  private readonly listeners = new Set<
    (previous: MediaSrc | null, current: MediaSrc | null) => Promise<void>
  >()

  subscribe(
    listener: (
      previous: MediaSrc | null,
      current: MediaSrc | null,
    ) => Promise<void>,
  ) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async publishChanged(previous: MediaSrc | null, current: MediaSrc | null) {
    if (
      previous?.src === current?.src &&
      previous?.source === current?.source
    ) {
      return
    }

    for (const listener of this.listeners) {
      try {
        await listener(previous, current)
      } catch (error) {
        this.logger.error("Account avatar change listener failed", error)
      }
    }
  }
}

export { AccountAvatarEventsService }
