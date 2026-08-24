import { Switch as SwitchPrimitive } from '@base-ui/react/switch'
import { cn } from '@shared/functions/utility/cn'
import { Text } from '@shared/ui/Text'
import { useSwitch } from './useSwitch'
import st from './Switch.module.scss'
import type { ISwitchProps } from '../types/ISwitchProps'
import { isNil } from '@shared/functions/checks/isNil'

const Switch = (props: ISwitchProps) => {
  const { className, handleChange, hintText, isDisabled, label, ref, value } =
    useSwitch(props)

  return (
    <label
      className={cn(st.root, className, {
        [st.root_disabled]: isDisabled,
      })}
    >
      <SwitchPrimitive.Root
        checked={value}
        className={st.switch}
        disabled={isDisabled}
        onCheckedChange={handleChange}
        ref={ref}
      >
        <SwitchPrimitive.Thumb className={st.thumb} />
      </SwitchPrimitive.Root>
      <span className={st.content}>
        <Text maxLines={2} weight={700} render={<span />}>
          {label}
        </Text>
        {!isNil(hintText) && (
          <Text
            className={st.hintText}
            fontSize={12}
            maxLines={2}
            render={<span />}
          >
            {hintText}
          </Text>
        )}
      </span>
    </label>
  )
}

export { Switch }
