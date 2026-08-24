import type { GameDocument } from "@entities/game/schemas/game.schema"
import type { GameResponseDto } from "../../../dto/response/game-list.response"

const toGameResponse = (game: GameDocument): GameResponseDto => {
  return {
    id: game._id.toString(),
    f95ThreadId: game.f95ThreadId,
    threadUrl: game.threadUrl,
    title: game.title,
    creatorId: game.creatorId.toString(),
    version: game.version,
    coverUrl: game.coverUrl,
    screenshotUrls: game.screenshotUrls,
    f95UpdatedAt: game.f95UpdatedAt,
    tagIds: game.tagIds.map((tagId) => {
      return tagId.toString()
    }),
    prefixIds: game.prefixIds.map((prefixId) => {
      return prefixId.toString()
    }),
    createdAt: game.createdAt,
    updatedAt: game.updatedAt,
  }
}

export { toGameResponse }
