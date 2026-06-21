import type { GameDto, UserGameStatus } from '@f95/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';

import { queryClient } from '../../../shared/api/queryClient';
import {
  useSwipeDecisionMutation,
  useSwipeUndoMutation,
} from '../api/swipe.mutations';
import {
  swipeQueueQueryKey,
  useSwipeQueueQuery,
} from '../api/swipe.queries';

const REFILL_THRESHOLD = 5;

function mergeQueue(
  currentItems: GameDto[],
  incomingItems: GameDto[],
): GameDto[] {
  const knownIds = new Set(currentItems.map((game) => game.id));

  return [
    ...currentItems,
    ...incomingItems.filter((game) => !knownIds.has(game.id)),
  ];
}

export function useSwipeQueue() {
  const queueQuery = useSwipeQueueQuery();
  const decisionMutation = useSwipeDecisionMutation();
  const undoMutation = useSwipeUndoMutation();
  const [items, setItems] = useState<GameDto[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const initializedAtRef = useRef(0);
  const refillPendingRef = useRef(false);

  useEffect(() => {
    if (
      !queueQuery.data ||
      queueQuery.dataUpdatedAt === initializedAtRef.current
    ) {
      return;
    }

    initializedAtRef.current = queueQuery.dataUpdatedAt;
    setItems((currentItems) =>
      currentItems.length === 0
        ? queueQuery.data.items
        : mergeQueue(currentItems, queueQuery.data.items),
    );
    refillPendingRef.current = false;
  }, [queueQuery.data, queueQuery.dataUpdatedAt]);

  const refillQueue = useCallback(async () => {
    if (refillPendingRef.current) {
      return;
    }

    refillPendingRef.current = true;

    try {
      await queryClient.invalidateQueries({
        queryKey: swipeQueueQueryKey,
        refetchType: 'active',
      });
    } finally {
      refillPendingRef.current = false;
    }
  }, []);

  const decide = useCallback(
    async (status: UserGameStatus) => {
      const game = items[0];

      if (!game || decisionMutation.isPending || undoMutation.isPending) {
        return;
      }

      const previousItems = items;
      const previousCanUndo = canUndo;
      const remainingItems = items.slice(1);

      setItems(remainingItems);
      setCanUndo(true);

      try {
        await decisionMutation.mutateAsync({
          gameId: game.id,
          status,
        });

        if (remainingItems.length <= REFILL_THRESHOLD) {
          void refillQueue();
        }
      } catch {
        setItems(previousItems);
        setCanUndo(previousCanUndo);
      }
    },
    [
      canUndo,
      decisionMutation,
      items,
      refillQueue,
      undoMutation.isPending,
    ],
  );

  const undo = useCallback(async () => {
    if (!canUndo || decisionMutation.isPending || undoMutation.isPending) {
      return;
    }

    const previousItems = items;
    setCanUndo(false);

    try {
      const result = await undoMutation.mutateAsync();

      if (result.status === null) {
        setItems((currentItems) => [
          result.game,
          ...currentItems.filter((game) => game.id !== result.game.id),
        ]);
      }
    } catch {
      setItems(previousItems);
      setCanUndo(true);
    }
  }, [canUndo, decisionMutation.isPending, items, undoMutation]);

  const retry = useCallback(() => {
    decisionMutation.reset();
    undoMutation.reset();
    void queueQuery.refetch();
  }, [decisionMutation, queueQuery, undoMutation]);

  return {
    canUndo,
    currentGame: items[0] ?? null,
    decide,
    error: decisionMutation.error ?? undoMutation.error ?? queueQuery.error,
    isLoading: queueQuery.isPending && items.length === 0,
    isMutating: decisionMutation.isPending || undoMutation.isPending,
    queueSize: items.length,
    retry,
    undo,
  };
}
