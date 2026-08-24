import type { useRender } from '@base-ui/react/use-render'
import type { Ref } from 'react'
import type { TIconName } from './TIconName'
import type { TIconSize } from './TIconSize'

interface IIconProps {
  name: TIconName

  className?: string
  ref?: Ref<SVGSVGElement>
  render?: useRender.ComponentProps<'svg'>['render']
  size?: TIconSize
}

export type { IIconProps }
