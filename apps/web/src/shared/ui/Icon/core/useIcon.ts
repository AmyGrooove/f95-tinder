import type { IIconProps } from '../types/IIconProps'
import { ICON_COMPONENTS } from '../static/ICON_COMPONENTS'

const useIcon = (props: IIconProps) => {
  const { className, name, ref, render, size } = props

  const IconComponent = ICON_COMPONENTS[name]

  return {
    className,
    IconComponent,
    ref,
    render,
    size,
  }
}

export { useIcon }
