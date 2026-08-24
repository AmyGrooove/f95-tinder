import { useRender } from '@base-ui/react/use-render'
import { cn } from '@shared/functions/utility/cn'
import { useKbd } from './useKbd'
import st from './Kbd.module.scss'
import type { IKbdProps } from '../types/IKbdProps'

const Kbd = (props: IKbdProps) => {
  const { children, className, ref, render } = useKbd(props)

  const element = useRender({
    defaultTagName: 'kbd',
    render,
    props: {
      children,
      className: cn(st.root, className),
      ref,
    },
  })

  return element
}

export { Kbd }
