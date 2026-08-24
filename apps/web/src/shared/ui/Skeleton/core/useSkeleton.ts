import type { ISkeletonProps } from '../types/ISkeletonProps'

const useSkeleton = (props: ISkeletonProps) => {
  const { className, isFlexShrinkDisabled = false, ref, render } = props

  return {
    className,
    isFlexShrinkDisabled,
    ref,
    render,
  }
}

export { useSkeleton }
