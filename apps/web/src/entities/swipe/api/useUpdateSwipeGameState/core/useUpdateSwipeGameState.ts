import { useMutation } from '@tanstack/react-query'

import { fetchData } from '@shared/functions/api/fetchData'

import type { IUpdateSwipeGameStateProps } from '../types/IUpdateSwipeGameStateProps'
import type { IUpdateSwipeGameStateResponse } from '../types/IUpdateSwipeGameStateResponse'

const updateSwipeGameState = (
  props: IUpdateSwipeGameStateProps,
): Promise<IUpdateSwipeGameStateResponse> => {
  return fetchData<IUpdateSwipeGameStateResponse>({
    method: 'POST',
    path: `/swipe/${props.gameId}/${props.listType}`,
  })
}

const useUpdateSwipeGameState = () => {
  return useMutation({ mutationFn: updateSwipeGameState })
}

export { useUpdateSwipeGameState }
