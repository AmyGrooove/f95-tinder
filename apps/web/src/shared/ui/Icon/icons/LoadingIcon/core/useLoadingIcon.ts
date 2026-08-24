import type { ILoadingIconProps } from '../types/ILoadingIconProps'

const useLoadingIcon = (props: ILoadingIconProps) => {
  const { className, ref, size } = props

  return {
    className,
    ref,
    size,
  }
}

export { useLoadingIcon }
