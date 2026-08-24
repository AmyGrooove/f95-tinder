import { useStore } from 'effector-react'
import { useQuery } from '@tanstack/react-query'

import { $accessToken } from '@entities/auth/stores/accessToken'
import { fetchData } from '@shared/functions/api/fetchData'
import { isNil } from '@shared/functions/checks/isNil'

import type { IGetSessionResponse } from '../types/IGetSessionResponse'

const getSession = (signal?: AbortSignal): Promise<IGetSessionResponse> => {
  return fetchData<IGetSessionResponse>({
    path: '/auth/session',
    signal,
  })
}

const useGetSession = () => {
  const accessToken = useStore($accessToken)

  return useQuery({
    enabled: !isNil(accessToken),
    queryFn: ({ signal }) => {
      return getSession(signal)
    },
    queryKey: ['auth', 'session'],
  })
}

export { useGetSession }
