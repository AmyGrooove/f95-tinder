import type { GameDocument } from "@entities/game/schemas/game.schema"

type TGameCursor = {
  f95UpdatedAt: string | null
  id: string
}

const createNextGameCursor = (games: GameDocument[]): string | null => {
  const game = games[games.length - 1]

  if (!game) {
    return null
  }

  const cursor: TGameCursor = {
    f95UpdatedAt: game.f95UpdatedAt?.toISOString() ?? null,
    id: game._id.toString(),
  }

  return Buffer.from(JSON.stringify(cursor)).toString("base64url")
}

export { createNextGameCursor }
