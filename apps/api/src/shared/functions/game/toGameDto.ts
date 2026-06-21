import type { GameDto } from '@f95/contracts';

import type { GameDocument } from '../../../entities/game/schemas/game.schema';

export function toGameDto(game: GameDocument): GameDto {
  return {
    id: String(game._id),
    f95ThreadId: game.f95ThreadId,
    threadUrl: `https://f95zone.to/threads/${game.f95ThreadId}`,
    title: game.title,
    creator: game.creator,
    version: game.version,
    views: game.views,
    likes: game.likes,
    rating: game.rating,
    tagIds: game.tagIds,
    prefixIds: game.prefixIds,
    coverUrl: game.coverUrl,
    screenshotUrls: game.screenshotUrls,
    publishedAt: game.publishedAt?.toISOString() ?? null,
    sourceUpdatedAt: game.sourceUpdatedAt.toISOString(),
  };
}
