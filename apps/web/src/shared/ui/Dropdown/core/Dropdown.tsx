import { Popover as PopoverPrimitive } from '@base-ui/react/popover'
import { cn } from '@shared/functions/utility/cn'
import { useDropdown } from './useDropdown'
import st from './Dropdown.module.scss'
import type { IDropdownProps } from '../types/IDropdownProps'

const Dropdown = (props: IDropdownProps) => {
  const {
    align,
    children,
    className,
    content,
    handleOpenChange,
    isDisabled,
    isOpen,
    side,
  } = useDropdown(props)

  return (
    <PopoverPrimitive.Root onOpenChange={handleOpenChange} open={isOpen}>
      <PopoverPrimitive.Trigger
        disabled={isDisabled}
        nativeButton={false}
        render={<span className={st.trigger}>{children}</span>}
      />
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          align={align}
          className={st.positioner}
          side={side}
          sideOffset={4}
        >
          <PopoverPrimitive.Popup className={cn(st.root, className)}>
            {content}
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}

export { Dropdown }
