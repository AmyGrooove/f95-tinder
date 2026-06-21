import type { TokenResponse } from '@f95/contracts';
import { useQuery } from '@tanstack/react-query';

import { httpClient } from '../../../shared/api/httpClient';

export const tokenQueryKey = ['auth', 'token'] as const;

export function useTokenQuery() {
  return useQuery({
    queryFn: () => httpClient.get<TokenResponse>('auth/token'),
    queryKey: tokenQueryKey,
    staleTime: Infinity,
  });
}
