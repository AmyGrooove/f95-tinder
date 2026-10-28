import type { ICollapsibleProps } from '../types/ICollapsibleProps'

const useCollapsible = (props: ICollapsibleProps) => {
  const { children, className, isOpen } = props

  return {
    children,
    className,
    isOpen,
  }
}

export { useCollapsible }
