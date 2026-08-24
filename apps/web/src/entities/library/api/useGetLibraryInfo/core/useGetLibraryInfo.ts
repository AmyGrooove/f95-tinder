import { useStore } from 'effector-react'
import { useQuery } from '@tanstack/react-query'

import { $accessToken } from '@entities/auth/stores/accessToken'
import { fetchData } from '@shared/functions/api/fetchData'
import { isNil } from '@shared/functions/checks/isNil'

import type { IGetLibraryInfoResponse } from '../types/IGetLibraryInfoResponse'

const getLibraryInfo = (
  signal?: AbortSignal,
): Promise<IGetLibraryInfoResponse> => {
  return fetchData<IGetLibraryInfoResponse>({
    path: '/me/library/info',
    signal,
  })
}

const useGetLibraryInfo = () => {
  const accessToken = useStore($accessToken)

  return useQuery({
    enabled: !isNil(accessToken),
    queryFn: ({ signal }) => {
      return getLibraryInfo(signal)
    },
    queryKey: ['library', 'info'],
  })
}

export { useGetLibraryInfo }
