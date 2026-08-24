import { useMutation } from '@tanstack/react-query'

import { fetchData } from '@shared/functions/api/fetchData'

import type { IGetCatalogSyncStatusResponse } from '../../useGetCatalogSyncStatus/types/IGetCatalogSyncStatusResponse'
import type { IUpdateCatalogSyncProps } from '../types/IUpdateCatalogSyncProps'

const updateCatalogSync = (
  props: IUpdateCatalogSyncProps,
): Promise<IGetCatalogSyncStatusResponse> => {
  return fetchData<IGetCatalogSyncStatusResponse>({
    method: 'POST',
    path: `/admin/sync/${props.action}`,
  })
}

const useUpdateCatalogSync = () => {
  return useMutation({ mutationFn: updateCatalogSync })
}

export { useUpdateCatalogSync }
