import type { ISeparatorProps } from '../types/ISeparatorProps'

const useSeparator = (props: ISeparatorProps) => {
  const { className, orientation = 'horizontal', ref } = props

  return {
    className,
    orientation,
    ref,
  }
}

export { useSeparator }
