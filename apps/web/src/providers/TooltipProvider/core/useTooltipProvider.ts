import type { ITooltipProviderProps } from '../types/ITooltipProviderProps'

const useTooltipProvider = (props: ITooltipProviderProps) => {
  const { children } = props

  return {
    children,
  }
}

export { useTooltipProvider }
