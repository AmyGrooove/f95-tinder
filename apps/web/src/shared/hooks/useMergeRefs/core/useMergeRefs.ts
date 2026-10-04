import { useMergeRefs as useFloatingMergeRefs } from '@floating-ui/react'
import type { Ref, RefObject } from 'react'

const useMergeRefs = <TElement>(
  primaryRef: RefObject<TElement | null>,
  secondaryRef?: Ref<TElement | null>,
) => {
  const mergedRef = useFloatingMergeRefs<TElement>([primaryRef, secondaryRef])

  return mergedRef
}

export { useMergeRefs }
