import type { EUserItemStatus } from "@entities/userItem/schemas/EUserItemStatus"

interface IUserItemStatsState {
  rating: number | null
  isFavorite: boolean
  status: EUserItemStatus
  completedAttemptsCount: number
}

export type { IUserItemStatsState }
