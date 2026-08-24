import type { TLibraryGameListType } from '@entities/library/types/TLibraryGameListType'

interface IUpdateSwipeGameStateResponse {
  createdAt: string
  gameId: string
  id: string
  listType: TLibraryGameListType
  updatedAt: string
  userId: string
}

export type { IUpdateSwipeGameStateResponse }
