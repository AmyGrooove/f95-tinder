import { useStore } from 'effector-react'
import { useQuery } from '@tanstack/react-query'

import { $accessToken } from '@entities/auth/stores/accessToken'
import { fetchData } from '@shared/functions/api/fetchData'
import { isNil } from '@shared/functions/checks/isNil'

import type { IGetSwipeQueueQuery } from '../types/IGetSwipeQueueQuery'
import type { IGetSwipeQueueResponse } from '../types/IGetSwipeQueueResponse'

const getSwipeQueue = (
  query: IGetSwipeQueueQuery,
  signal?: AbortSignal,
): Promise<IGetSwipeQueueResponse> => {
  return fetchData<IGetSwipeQueueResponse>({
    path: '/swipe/queue',
    query,
    signal,
  })
}

const useGetSwipeQueue = (query: IGetSwipeQueueQuery = {}) => {
  const accessToken = useStore($accessToken)

  return useQuery({
    enabled: !isNil(accessToken),
    queryFn: ({ signal }) => {
      return getSwipeQueue(query, signal)
    },
    queryKey: ['swipe', 'queue', query],
  })
}

export { useGetSwipeQueue }
