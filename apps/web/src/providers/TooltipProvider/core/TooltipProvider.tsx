import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip'
import { useTooltipProvider } from './useTooltipProvider'
import type { ITooltipProviderProps } from '../types/ITooltipProviderProps'

const TooltipProvider = (props: ITooltipProviderProps) => {
  const { children } = useTooltipProvider(props)

  return (
    <TooltipPrimitive.Provider closeDelay={0} delay={0} timeout={400}>
      {children}
    </TooltipPrimitive.Provider>
  )
}

export { TooltipProvider }
