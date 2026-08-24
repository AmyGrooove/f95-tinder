import type { Ref } from 'react'
import type { ITabItem } from './ITabItem'

interface ITabsProps {
  items: ITabItem[]
  onChange: (value: string) => void
  value: string

  className?: string
  ref?: Ref<HTMLDivElement>
}

export type { ITabsProps }
