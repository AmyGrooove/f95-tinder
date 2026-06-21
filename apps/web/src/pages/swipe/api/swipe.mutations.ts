import type {
  CreateDecisionRequest,
  DecisionResponse,
  UndoResponse,
} from '@f95/contracts';
import { useMutation } from '@tanstack/react-query';

import { httpClient } from '../../../shared/api/httpClient';

export function useSwipeDecisionMutation() {
  return useMutation({
    mutationFn: (request: CreateDecisionRequest) =>
      httpClient.post<DecisionResponse, CreateDecisionRequest>(
        'swipe/decisions',
        request,
      ),
  });
}

export function useSwipeUndoMutation() {
  return useMutation({
    mutationFn: () => httpClient.post<UndoResponse>('swipe/undo'),
  });
}
