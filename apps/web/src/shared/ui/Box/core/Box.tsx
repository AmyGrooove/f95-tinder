import { useRender } from '@base-ui/react/use-render'
import { cn } from '@shared/functions/utility/cn'
import { useBox } from './useBox'
import st from './Box.module.scss'
import type { IBoxProps } from '../types/IBoxProps'

const Box = (props: IBoxProps) => {
  const {
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
  } = useBox(props)

  const element = useRender({
    defaultTagName: 'div',
    render,
    props: {
      children,
      className: cn(
        st.root,
        st[`root_flexDirection_${flexDirection}`],
        st[`root_alignItems_${alignItems}`],
        st[`root_justifyContent_${justifyContent}`],
        st[`root_gap_${gap}`],
        st[`root_flexWrap_${flexWrap}`],
        className,
      ),
      style,
      tabIndex: isFocusable ? 0 : undefined,
      ref,
    },
  })

  return element
}

export { Box }
