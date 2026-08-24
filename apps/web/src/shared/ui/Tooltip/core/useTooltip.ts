import type { ITooltipProps } from '../types/ITooltipProps'

const useTooltip = (props: ITooltipProps) => {
  const {
    align = 'center',
    children,
    className,
    content,
    isDisabled = false,
    side = 'top',
  } = props

  return {
    align,
    children,
    className,
    content,
    isDisabled,
    side,
  }
}

export { useTooltip }
