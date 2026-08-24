import { useStore } from 'effector-react'
import { useQuery } from '@tanstack/react-query'

import { $accessToken } from '@entities/auth/stores/accessToken'
import { fetchData } from '@shared/functions/api/fetchData'
import { isNil } from '@shared/functions/checks/isNil'

import type { TLibraryGameListType } from '@entities/library/types/TLibraryGameListType'
import type { IGetLibraryGamesResponse } from '../types/IGetLibraryGamesResponse'

const getLibraryGames = (
  listType: TLibraryGameListType,
  signal?: AbortSignal,
): Promise<IGetLibraryGamesResponse> => {
  const listPath = listType === 'favorite' ? 'favorites' : listType

  return fetchData<IGetLibraryGamesResponse>({
    path: `/me/library/${listPath}`,
    signal,
  })
}

const useGetLibraryGames = (listType: TLibraryGameListType) => {
  const accessToken = useStore($accessToken)

  return useQuery({
    enabled: !isNil(accessToken),
    queryFn: ({ signal }) => {
      return getLibraryGames(listType, signal)
    },
    queryKey: ['library', listType],
  })
}

export { useGetLibraryGames }
