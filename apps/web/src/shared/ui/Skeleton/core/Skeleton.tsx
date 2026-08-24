import { useRender } from '@base-ui/react/use-render'
import { cn } from '@shared/functions/utility/cn'
import { useSkeleton } from './useSkeleton'
import st from './Skeleton.module.scss'
import type { ISkeletonProps } from '../types/ISkeletonProps'

const Skeleton = (props: ISkeletonProps) => {
  const { className, isFlexShrinkDisabled, ref, render } = useSkeleton(props)

  const element = useRender({
    defaultTagName: 'div',
    render,
    props: {
      className: cn(st.root, className, {
        [st.root_flexShrinkDisabled]: isFlexShrinkDisabled,
      }),
      ref,
    },
  })

  return element
}

export { Skeleton }
