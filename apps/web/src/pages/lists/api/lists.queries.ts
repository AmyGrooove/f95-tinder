import type { GameListResponse, UserGameStatus } from "@f95/contracts"
import { useInfiniteQuery } from "@tanstack/react-query"

import { httpClient } from "../../../shared/api/httpClient"

export const listsQueryKey = ["lists"] as const

export function listQueryKey(status: UserGameStatus) {
  return [...listsQueryKey, status] as const
}

export function useGameListQuery(status: UserGameStatus) {
  return useInfiniteQuery({
    getNextPageParam: (lastPage) => (lastPage as any).nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => {
      const search = new URLSearchParams()

      if (pageParam) {
        search.set("cursor", pageParam)
      }

      const query = search.toString()

      return httpClient.get<GameListResponse>(
        `lists/${status}${query ? `?${query}` : ""}`,
      )
    },
    queryKey: listQueryKey(status),
  })
}
