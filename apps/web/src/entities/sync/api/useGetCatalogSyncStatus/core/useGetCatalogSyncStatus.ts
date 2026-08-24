import { useStore } from 'effector-react'
import { useQuery } from '@tanstack/react-query'

import { $accessToken } from '@entities/auth/stores/accessToken'
import { fetchData } from '@shared/functions/api/fetchData'
import { isNil } from '@shared/functions/checks/isNil'

import type { IGetCatalogSyncStatusResponse } from '../types/IGetCatalogSyncStatusResponse'

const getCatalogSyncStatus = (
  signal?: AbortSignal,
): Promise<IGetCatalogSyncStatusResponse> => {
  return fetchData<IGetCatalogSyncStatusResponse>({
    path: '/admin/sync/catalog/status',
    signal,
  })
}

const useGetCatalogSyncStatus = () => {
  const accessToken = useStore($accessToken)

  return useQuery({
    enabled: !isNil(accessToken),
    queryFn: ({ signal }) => {
      return getCatalogSyncStatus(signal)
    },
    queryKey: ['admin', 'sync', 'catalog', 'status'],
  })
}

export { useGetCatalogSyncStatus }
