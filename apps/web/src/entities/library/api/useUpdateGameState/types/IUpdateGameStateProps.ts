import type { TLibraryGameListType } from '@entities/library/types/TLibraryGameListType'

interface IUpdateGameStateProps {
  gameId: string
  listType: TLibraryGameListType
}

export type { IUpdateGameStateProps }
