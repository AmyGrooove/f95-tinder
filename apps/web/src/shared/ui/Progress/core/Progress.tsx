import { Progress as ProgressPrimitive } from '@base-ui/react/progress'
import { isNil } from '@shared/functions/checks/isNil'
import { cn } from '@shared/functions/utility/cn'
import { Text } from '@shared/ui/Text'
import { useProgress } from './useProgress'
import st from './Progress.module.scss'
import type { IProgressProps } from '../types/IProgressProps'

const Progress = (props: IProgressProps) => {
  const {
    className,
    isError,
    isMessageVisible,
    label,
    max,
    message,
    ref,
    value,
  } = useProgress(props)

  return (
    <ProgressPrimitive.Root
      className={cn(st.root, className, {
        [st.root_error]: isError,
      })}
      max={max}
      ref={ref}
      value={value}
    >
      {!isNil(label) && (
        <ProgressPrimitive.Label>
          <Text maxLines={2} weight={700} render={<span />}>
            {label}
          </Text>
        </ProgressPrimitive.Label>
      )}
      <ProgressPrimitive.Track className={st.track}>
        <ProgressPrimitive.Indicator className={st.indicator} />
      </ProgressPrimitive.Track>
      {isMessageVisible && (
        <Text className={st.hint} fontSize={12} maxLines={2} render={<span />}>
          {message}
        </Text>
      )}
    </ProgressPrimitive.Root>
  )
}

export { Progress }
