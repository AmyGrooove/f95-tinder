import { useQuery } from '@tanstack/react-query'

import { fetchData } from '@shared/functions/api/fetchData'

import type { IGetGamesQuery } from '../types/IGetGamesQuery'
import type { IGetGamesResponse } from '../types/IGetGamesResponse'

const getGames = (
  query: IGetGamesQuery,
  signal?: AbortSignal,
): Promise<IGetGamesResponse> => {
  return fetchData<IGetGamesResponse>({
    path: '/games',
    query,
    signal,
  })
}

const useGetGames = (query: IGetGamesQuery = {}) => {
  return useQuery({
    queryFn: ({ signal }) => {
      return getGames(query, signal)
    },
    queryKey: ['games', query],
  })
}

export { useGetGames }
