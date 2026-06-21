import { QueryClient } from '@tanstack/react-query';

import { ApiError } from './apiError';

export const queryClient = new QueryClient({
  defaultOptions: {
    mutations: {
      retry: false,
    },
    queries: {
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) =>
        error instanceof ApiError &&
        error.status >= 500 &&
        failureCount < 2,
      staleTime: 30 * 1000,
    },
  },
});
