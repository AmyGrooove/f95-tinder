import { resolveMediaUrl } from "@endpoints/shared/functions/resolveMediaUrl"
import type { EMediaType } from "@entities/shared/schemas/EMediaType"
import type { MediaSrc } from "@entities/shared/schemas/mediaSrc.schema"
import type { StorageService } from "@infrastructure/storage/services/storageService"
import { isUndefined } from "@shared/functions/checks/isUndefined"

const mapMediaSources = <TMediaType extends EMediaType>(
  sources: readonly (MediaSrc & { type: TMediaType })[],
  storage: Pick<StorageService, "createPublicUrl">,
) => {
  return sources.flatMap((media) => {
    const src = resolveMediaUrl(media, storage)

    return isUndefined(src)
      ? []
      : [{ src, language: media.language ?? null, type: media.type }]
  })
}

export { mapMediaSources }
