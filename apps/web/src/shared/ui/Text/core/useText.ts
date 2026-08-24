import { isNil } from '@shared/functions/checks/isNil'
import type { ITextProps } from '../types/ITextProps'

const useText = (props: ITextProps) => {
  const {
    children,
    className,
    fontSize = 16,
    maxLines,
    ref,
    render,
    weight = 400,
  } = props

  const isMaxLinesEnabled = !isNil(maxLines)
  const style = {
    WebkitLineClamp: maxLines,
  }

  return {
    children,
    className,
    fontSize,
    isMaxLinesEnabled,
    ref,
    render,
    style,
    weight,
  }
}

export { useText }
