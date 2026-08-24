import { F95_ORIGIN } from "../../../static/F95_ORIGIN"
import type { TF95NormalizedGame } from "../../../types/TF95NormalizedGame"
import type { INormalizeF95GameProps } from "../types/INormalizeF95GameProps"

const normalizeF95Game = (
  props: INormalizeF95GameProps,
): TF95NormalizedGame => {
  const { threadItem } = props
  const f95UpdatedAt =
    Number.isFinite(threadItem.ts) && threadItem.ts > 0
      ? new Date(threadItem.ts * 1_000)
      : null

  return {
    f95ThreadId: threadItem.thread_id,
    threadUrl: `${F95_ORIGIN}/threads/${threadItem.thread_id}`,
    title: threadItem.title,
    creator: threadItem.creator,
    version: threadItem.version,
    coverUrl: threadItem.cover.trim().length > 0 ? threadItem.cover : null,
    screenshotUrls: threadItem.screens,
    f95UpdatedAt,
    f95TagIds: threadItem.tags,
    f95PrefixIds: threadItem.prefixes,
  }
}

export { normalizeF95Game }
