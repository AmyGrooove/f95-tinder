import type { EUserItemStatus } from "@entities/userItem/schemas/EUserItemStatus"

interface IUserItemMetricState {
  rating: number | null
  isFavorite: boolean
  status: EUserItemStatus
  completedAttemptsCount: number
}

export type { IUserItemMetricState }
