import { useQuery } from '@tanstack/react-query'

import { fetchData } from '@shared/functions/api/fetchData'
import { isNil } from '@shared/functions/checks/isNil'

import type { IGetGameResponse } from '../types/IGetGameResponse'

const getGame = (
  gameId: string,
  signal?: AbortSignal,
): Promise<IGetGameResponse> => {
  return fetchData<IGetGameResponse>({
    path: `/games/${gameId}`,
    signal,
  })
}

const useGetGame = (gameId: string | null) => {
  return useQuery({
    enabled: !isNil(gameId),
    queryFn: ({ signal }) => {
      if (isNil(gameId)) {
        throw new Error('Game identifier is required')
      }

      return getGame(gameId, signal)
    },
    queryKey: ['games', gameId],
  })
}

export { useGetGame }
