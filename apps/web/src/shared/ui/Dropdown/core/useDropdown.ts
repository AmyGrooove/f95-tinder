import type { IDropdownProps } from '../types/IDropdownProps'

const useDropdown = (props: IDropdownProps) => {
  const {
    align = 'center',
    children,
    className,
    content,
    isDisabled = false,
    isOpen,
    onOpenChange,
    side = 'bottom',
  } = props

  const handleOpenChange = (nextIsOpen: boolean) => {
    onOpenChange?.(nextIsOpen)
  }

  return {
    align,
    children,
    className,
    content,
    handleOpenChange,
    isDisabled,
    isOpen,
    side,
  }
}

export { useDropdown }
