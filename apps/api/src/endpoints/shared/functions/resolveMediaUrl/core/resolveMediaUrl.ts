import { EMediaSource } from "@entities/shared/schemas/EMediaSource"
import type { MediaSrc } from "@entities/shared/schemas/mediaSrc.schema"
import type { StorageService } from "@infrastructure/storage/services/storageService"

const resolveMediaUrl = (
  media: Pick<MediaSrc, "src" | "source"> | null | undefined,
  storage: Pick<StorageService, "createPublicUrl">,
) => {
  return media?.source === EMediaSource.STORAGE_KEY
    ? storage.createPublicUrl(media.src)
    : media?.src
}

export { resolveMediaUrl }
