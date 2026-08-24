import { useRender } from '@base-ui/react/use-render'
import { cn } from '@shared/functions/utility/cn'
import { useText } from './useText'
import st from './Text.module.scss'
import type { ITextProps } from '../types/ITextProps'

const Text = (props: ITextProps) => {
  const {
    children,
    className,
    fontSize,
    isMaxLinesEnabled,
    ref,
    render,
    style,
    weight,
  } = useText(props)

  const element = useRender({
    defaultTagName: 'div',
    render,
    props: {
      children,
      className: cn(
        st.root,
        st[`root_fontSize_${fontSize}`],
        st[`root_weight_${weight}`],
        className,
        { [st.root_clamped]: isMaxLinesEnabled },
      ),
      ref,
      style,
    },
  })

  return element
}

export { Text }
