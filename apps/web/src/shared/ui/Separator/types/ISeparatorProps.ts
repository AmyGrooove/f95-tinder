import type { Ref } from 'react'
import type { TSeparatorOrientation } from './TSeparatorOrientation'

interface ISeparatorProps {
  className?: string
  orientation?: TSeparatorOrientation
  ref?: Ref<HTMLDivElement>
}

export type { ISeparatorProps }
