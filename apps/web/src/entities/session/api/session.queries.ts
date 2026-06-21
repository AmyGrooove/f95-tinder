import type { SessionResponse } from '@f95/contracts';
import { useQuery } from '@tanstack/react-query';

import { httpClient } from '../../../shared/api/httpClient';

export const sessionQueryKey = ['session'] as const;

export function useSessionQuery(enabled = true) {
  return useQuery({
    enabled,
    queryFn: () => httpClient.get<SessionResponse>('auth/session'),
    queryKey: sessionQueryKey,
    staleTime: 60 * 1000,
  });
}
