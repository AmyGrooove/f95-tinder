import { useQuery } from '@tanstack/react-query'

import { fetchData } from '@shared/functions/api/fetchData'

import type { IGetLatestGamesQuery } from '../types/IGetLatestGamesQuery'
import type { IGetLatestGamesResponse } from '../types/IGetLatestGamesResponse'

const getLatestGames = (
  query: IGetLatestGamesQuery,
  signal?: AbortSignal,
): Promise<IGetLatestGamesResponse> => {
  return fetchData<IGetLatestGamesResponse>({
    path: '/games/latest',
    query,
    signal,
  })
}

const useGetLatestGames = (query: IGetLatestGamesQuery = {}) => {
  return useQuery({
    queryFn: ({ signal }) => {
      return getLatestGames(query, signal)
    },
    queryKey: ['games', 'latest', query],
  })
}

export { useGetLatestGames }
