import { useImperativeHandle } from 'react'
import type { Ref, RefObject } from 'react'

const useMergeRefs = <TElement>(
  primaryRef: RefObject<TElement | null>,
  secondaryRef?: Ref<TElement | null>,
): RefObject<TElement | null> => {
  useImperativeHandle<TElement | null, TElement | null>(secondaryRef, () => {
    return primaryRef.current
  }, [primaryRef])

  return primaryRef
}

export { useMergeRefs }
