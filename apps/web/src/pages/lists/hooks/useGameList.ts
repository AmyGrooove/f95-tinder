import type {
  GameListItemDto,
  GameListResponse,
  UserGameStatus,
} from "@f95/contracts"
import type { InfiniteData } from "@tanstack/react-query"
import { useCallback } from "react"

import { queryClient } from "../../../shared/api/queryClient"
import { swipeQueueQueryKey } from "../../swipe/api/swipe.queries"
import {
  useDeleteGameStatusMutation,
  useUpdateGameStatusMutation,
} from "../api/lists.mutations"
import { listsQueryKey, useGameListQuery } from "../api/lists.queries"

type ListCacheSnapshot = [
  readonly unknown[],
  InfiniteData<GameListResponse> | undefined,
]

function removeGame(
  data: InfiniteData<GameListResponse> | undefined,
  gameId: string,
): InfiniteData<GameListResponse> | undefined {
  if (!data) {
    return data
  }

  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.filter((item) => item.game.id !== gameId),
    })),
  }
}

function addGame(
  data: InfiniteData<GameListResponse> | undefined,
  item: GameListItemDto,
): InfiniteData<GameListResponse> {
  if (!data || data.pages.length === 0) {
    return {
      pageParams: [undefined],
      pages: [{ items: [item], nextCursor: null }],
    }
  }

  const withoutGame = removeGame(data, item.game.id)

  if (!withoutGame) {
    return {
      pageParams: [undefined],
      pages: [{ items: [item], nextCursor: null }],
    }
  }

  return {
    ...withoutGame,
    pages: withoutGame.pages.map((page, index) =>
      index === 0 ? { ...page, items: [item, ...page.items] } : page,
    ),
  }
}

export function useGameList(status: UserGameStatus) {
  const listQuery = useGameListQuery(status)
  const updateMutation = useUpdateGameStatusMutation()
  const deleteMutation = useDeleteGameStatusMutation()
  const items =
    listQuery.data?.pages.flatMap((page) => (page as any).items) ?? []

  const captureSnapshot = useCallback(
    () =>
      queryClient.getQueriesData<InfiniteData<GameListResponse>>({
        queryKey: listsQueryKey,
      }) as ListCacheSnapshot[],
    [],
  )

  const restoreSnapshot = useCallback((snapshot: ListCacheSnapshot[]) => {
    for (const [queryKey, data] of snapshot) {
      queryClient.setQueryData(queryKey, data)
    }
  }, [])

  const invalidateRelatedQueries = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: listsQueryKey }),
      queryClient.invalidateQueries({ queryKey: swipeQueueQueryKey }),
    ])
  }, [])

  const moveGame = useCallback(
    async (item: GameListItemDto, nextStatus: UserGameStatus) => {
      if (
        item.status === nextStatus ||
        updateMutation.isPending ||
        deleteMutation.isPending
      ) {
        return
      }

      await queryClient.cancelQueries({ queryKey: listsQueryKey })
      const snapshot = captureSnapshot()
      const optimisticItem: GameListItemDto = {
        ...item,
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      }

      queryClient.setQueriesData<InfiniteData<GameListResponse>>(
        { queryKey: listsQueryKey },
        (data) => removeGame(data, item.game.id),
      )
      queryClient.setQueryData<InfiniteData<GameListResponse>>(
        [...listsQueryKey, nextStatus],
        (data) => addGame(data, optimisticItem),
      )

      try {
        await updateMutation.mutateAsync({
          gameId: item.game.id,
          status: nextStatus,
        })
        await invalidateRelatedQueries()
      } catch {
        restoreSnapshot(snapshot)
      }
    },
    [
      captureSnapshot,
      deleteMutation.isPending,
      invalidateRelatedQueries,
      restoreSnapshot,
      updateMutation,
    ],
  )

  const deleteGame = useCallback(
    async (item: GameListItemDto) => {
      if (updateMutation.isPending || deleteMutation.isPending) {
        return
      }

      await queryClient.cancelQueries({ queryKey: listsQueryKey })
      const snapshot = captureSnapshot()

      queryClient.setQueriesData<InfiniteData<GameListResponse>>(
        { queryKey: listsQueryKey },
        (data) => removeGame(data, item.game.id),
      )

      try {
        await deleteMutation.mutateAsync(item.game.id)
        await invalidateRelatedQueries()
      } catch {
        restoreSnapshot(snapshot)
      }
    },
    [
      captureSnapshot,
      deleteMutation,
      invalidateRelatedQueries,
      restoreSnapshot,
      updateMutation.isPending,
    ],
  )

  const retry = useCallback(() => {
    updateMutation.reset()
    deleteMutation.reset()
    void listQuery.refetch()
  }, [deleteMutation, listQuery, updateMutation])

  return {
    deleteGame,
    error: listQuery.error ?? updateMutation.error ?? deleteMutation.error,
    fetchNextPage: listQuery.fetchNextPage,
    hasNextPage: listQuery.hasNextPage,
    isFetchingNextPage: listQuery.isFetchingNextPage,
    isLoading: listQuery.isPending,
    isMutating: updateMutation.isPending || deleteMutation.isPending,
    items,
    moveGame,
    retry,
  }
}
