import type { IToastProviderProps } from '../types/IToastProviderProps'

const useToastProvider = (props: IToastProviderProps) => {
  const { children } = props

  return {
    children,
  }
}

export { useToastProvider }
