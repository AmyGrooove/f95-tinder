import type { CatalogSyncStatus } from '@f95/contracts';
import { useQuery } from '@tanstack/react-query';

import { httpClient } from '../../../shared/api/httpClient';

export const catalogSyncQueryKey = ['catalog', 'sync', 'status'] as const;

export function useCatalogSyncQuery() {
  return useQuery({
    queryFn: () =>
      httpClient.get<CatalogSyncStatus>('catalog/sync/status'),
    queryKey: catalogSyncQueryKey,
    refetchInterval: 60_000,
  });
}
