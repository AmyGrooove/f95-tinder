import type { SwipeQueueResponse } from '@f95/contracts';
import { useQuery } from '@tanstack/react-query';

import { httpClient } from '../../../shared/api/httpClient';

export const swipeQueueQueryKey = ['swipe', 'queue'] as const;

export function useSwipeQueueQuery() {
  return useQuery({
    queryFn: () => httpClient.get<SwipeQueueResponse>('swipe/queue'),
    queryKey: swipeQueueQueryKey,
  });
}
