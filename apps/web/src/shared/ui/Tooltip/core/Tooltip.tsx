import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip'
import { cn } from '@shared/functions/utility/cn'
import { useTooltip } from './useTooltip'
import st from './Tooltip.module.scss'
import type { ITooltipProps } from '../types/ITooltipProps'

const Tooltip = (props: ITooltipProps) => {
  const { align, children, className, content, isDisabled, side } =
    useTooltip(props)

  return (
    <TooltipPrimitive.Root disableHoverablePopup disabled={isDisabled}>
      <TooltipPrimitive.Trigger
        render={<span className={st.trigger}>{children}</span>}
      />
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner
          align={align}
          className={st.positioner}
          side={side}
          sideOffset={4}
        >
          <TooltipPrimitive.Popup className={cn(st.root, className)}>
            <span>{content}</span>
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}

export { Tooltip }
