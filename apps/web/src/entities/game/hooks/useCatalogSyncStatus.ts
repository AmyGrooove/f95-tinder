import { useEffect, useState } from 'react';

import { queryClient } from '../../../shared/api/queryClient';
import { subscribeToCatalogSyncEvents } from '../api/catalogSync.events';
import {
  catalogSyncQueryKey,
  useCatalogSyncQuery,
} from '../api/catalogSync.query';

export function useCatalogSyncStatus() {
  const statusQuery = useCatalogSyncQuery();
  const [isConnected, setIsConnected] = useState(false);

  useEffect(
    () =>
      subscribeToCatalogSyncEvents({
        onEvent: (event) => {
          queryClient.setQueryData(catalogSyncQueryKey, event.data);
        },
        onOpen: () => {
          setIsConnected(true);
          void statusQuery.refetch();
        },
        onReconnect: () => {
          setIsConnected(false);
          void statusQuery.refetch();
        },
      }),
    [statusQuery.refetch],
  );

  return {
    error: statusQuery.error,
    isConnected,
    isLoading: statusQuery.isPending,
    refetch: statusQuery.refetch,
    status: statusQuery.data ?? null,
  };
}
