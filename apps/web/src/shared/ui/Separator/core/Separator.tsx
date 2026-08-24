import { Separator as SeparatorPrimitive } from '@base-ui/react/separator'
import { cn } from '@shared/functions/utility/cn'
import { useSeparator } from './useSeparator'
import st from './Separator.module.scss'
import type { ISeparatorProps } from '../types/ISeparatorProps'

const Separator = (props: ISeparatorProps) => {
  const { className, orientation, ref } = useSeparator(props)

  return (
    <SeparatorPrimitive
      className={cn(st.root, className)}
      orientation={orientation}
      ref={ref}
    />
  )
}

export { Separator }
