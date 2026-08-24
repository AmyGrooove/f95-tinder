import { useRender } from '@base-ui/react/use-render'
import { cn } from '@shared/functions/utility/cn'
import { useIcon } from './useIcon'
import st from './Icon.module.scss'
import type { IIconProps } from '../types/IIconProps'

const Icon = (props: IIconProps) => {
  const { className, IconComponent, ref, render, size } = useIcon(props)

  const element = useRender({
    defaultTagName: 'svg',
    render: render ?? <IconComponent />,
    props: {
      className: cn(st.root, st[`root_size_${size}`], className),
      ref,
    },
  })

  return element
}

export { Icon }
