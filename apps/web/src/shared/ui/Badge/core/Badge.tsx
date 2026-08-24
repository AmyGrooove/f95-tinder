import { useRender } from '@base-ui/react/use-render'
import { cn } from '@shared/functions/utility/cn'
import { useBadge } from './useBadge'
import st from './Badge.module.scss'
import type { IBadgeProps } from '../types/IBadgeProps'

const Badge = (props: IBadgeProps) => {
  const { children, className, isIconOnly, ref, render, size, variant } =
    useBadge(props)

  const element = useRender({
    defaultTagName: 'span',
    render,
    props: {
      children: <span className={st.content}>{children}</span>,
      className: cn(
        st.root,
        st[`root_size_${size}`],
        st[`root_variant_${variant}`],
        className,
        {
          [st.root_iconOnly]: isIconOnly,
        },
      ),
      ref,
    },
  })

  return element
}

export { Badge }
