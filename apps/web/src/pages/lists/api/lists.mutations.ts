import type {
  DeleteGameStatusResponse,
  UpdateGameStatusRequest,
  UpdateGameStatusResponse,
} from '@f95/contracts';
import { useMutation } from '@tanstack/react-query';

import { httpClient } from '../../../shared/api/httpClient';

export function useUpdateGameStatusMutation() {
  return useMutation({
    mutationFn: ({
      gameId,
      status,
    }: UpdateGameStatusRequest & { gameId: string }) =>
      httpClient.patch<UpdateGameStatusResponse, UpdateGameStatusRequest>(
        `lists/games/${gameId}`,
        { status },
      ),
  });
}

export function useDeleteGameStatusMutation() {
  return useMutation({
    mutationFn: (gameId: string) =>
      httpClient.delete<DeleteGameStatusResponse>(
        `lists/games/${gameId}`,
      ),
  });
}
