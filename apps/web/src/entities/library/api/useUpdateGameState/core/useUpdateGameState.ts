import { useMutation } from '@tanstack/react-query'

import { fetchData } from '@shared/functions/api/fetchData'

import type { IUpdateGameStateProps } from '../types/IUpdateGameStateProps'
import type { IUpdateGameStateResponse } from '../types/IUpdateGameStateResponse'

const updateGameState = (
  props: IUpdateGameStateProps,
): Promise<IUpdateGameStateResponse> => {
  return fetchData<IUpdateGameStateResponse>({
    body: { listType: props.listType },
    method: 'PATCH',
    path: `/me/games/${props.gameId}/state`,
  })
}

const useUpdateGameState = () => {
  return useMutation({ mutationFn: updateGameState })
}

export { useUpdateGameState }
