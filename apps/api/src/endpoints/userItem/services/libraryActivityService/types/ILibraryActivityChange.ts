import type { EUserItemStatus } from "@entities/userItem/schemas/EUserItemStatus"
import type { Types } from "mongoose"

interface ILibraryActivityState {
  status: EUserItemStatus
  rating: number | null
  isFavorite: boolean
}

interface ILibraryActivityChange {
  user: Types.ObjectId
  item: Types.ObjectId
  before: ILibraryActivityState | null
  after: ILibraryActivityState | null
}

interface IPendingLibraryActivity {
  id: string
  pair: string
  before: ILibraryActivityState | null
  after: ILibraryActivityState | null
  observedAt: number
}

export type {
  ILibraryActivityChange,
  ILibraryActivityState,
  IPendingLibraryActivity,
}
