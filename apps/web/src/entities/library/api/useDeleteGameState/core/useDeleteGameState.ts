import { useMutation } from '@tanstack/react-query'

import { fetchData } from '@shared/functions/api/fetchData'

import type { IDeleteGameStateProps } from '../types/IDeleteGameStateProps'

const deleteGameState = (props: IDeleteGameStateProps): Promise<void> => {
  return fetchData<void>({
    method: 'DELETE',
    path: `/me/games/${props.gameId}`,
  })
}

const useDeleteGameState = () => {
  return useMutation({ mutationFn: deleteGameState })
}

export { useDeleteGameState }
