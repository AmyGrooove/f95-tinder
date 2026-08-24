import { isNil } from '@shared/functions/checks/isNil'
import type { ITabsProps } from '../types/ITabsProps'

const useTabs = (props: ITabsProps) => {
  const { className, items, onChange, ref, value } = props

  const handleChange = (nextValue: string | null) => {
    if (isNil(nextValue)) {
      return
    }

    onChange(nextValue)
  }

  return {
    className,
    handleChange,
    items,
    ref,
    value,
  }
}

export { useTabs }
