import type { IBoxProps } from '../types/IBoxProps'

const useBox = (props: IBoxProps) => {
  const {
    alignItems = 'normal',
    children,
    className,
    flexDirection = 'row',
    gap = 0,
    justifyContent = 'normal',
    flexWrap = 'nowrap',
    ref,
    isFocusable = false,
    render,
    style,
  } = props

  return {
    alignItems,
    children,
    className,
    flexDirection,
    gap,
    justifyContent,
    flexWrap,
    ref,
    isFocusable,
    render,
    style,
  }
}

export { useBox }
