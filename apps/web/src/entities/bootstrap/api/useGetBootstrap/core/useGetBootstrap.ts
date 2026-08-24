import { useStore } from 'effector-react'
import { useQuery } from '@tanstack/react-query'

import { $accessToken } from '@entities/auth/stores/accessToken'
import { fetchData } from '@shared/functions/api/fetchData'
import { isNil } from '@shared/functions/checks/isNil'

import type { IGetBootstrapResponse } from '../types/IGetBootstrapResponse'

const getBootstrap = (signal?: AbortSignal): Promise<IGetBootstrapResponse> => {
  return fetchData<IGetBootstrapResponse>({ path: '/app/bootstrap', signal })
}

const useGetBootstrap = () => {
  const accessToken = useStore($accessToken)

  return useQuery({
    enabled: !isNil(accessToken),
    queryFn: ({ signal }) => {
      return getBootstrap(signal)
    },
    queryKey: ['app', 'bootstrap'],
  })
}

export { useGetBootstrap }
