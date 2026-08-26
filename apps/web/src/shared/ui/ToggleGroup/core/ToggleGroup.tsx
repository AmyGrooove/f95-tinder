import { Toggle as TogglePrimitive } from '@base-ui/react/toggle'
import { ToggleGroup as ToggleGroupPrimitive } from '@base-ui/react/toggle-group'
import { isNil } from '@shared/functions/checks/isNil'
import { cn } from '@shared/functions/utility/cn'
import { Icon } from '@shared/ui/Icon'
import { Text } from '@shared/ui/Text'
import { useToggleGroup } from './useToggleGroup'
import st from './ToggleGroup.module.scss'
import type { IToggleGroupProps } from '../types/IToggleGroupProps'

const ToggleGroup = (props: IToggleGroupProps) => {
  const {
    className,
    handleValueChange,
    hintText,
    isDisabled,
    label,
    options,
    ref,
    value,
  } = useToggleGroup(props)

  return (
    <div className={cn(st.root, className)}>
      {!isNil(label) && (
        <Text maxLines={2} weight={700} render={<span />}>
          {label}
        </Text>
      )}
      <ToggleGroupPrimitive
        className={st.options}
        disabled={isDisabled}
        multiple
        onValueChange={handleValueChange}
        ref={ref}
        value={value}
      >
        {options.map((option) => {
          const isOptionDisabled =
            (!isNil(option.isDisabled) && option.isDisabled) || isDisabled

          return (
            <TogglePrimitive
              className={cn(st.option, {
                [st.option_disabled]: isOptionDisabled,
              })}
              disabled={isOptionDisabled}
              key={option.value}
              value={option.value}
            >
              {!isNil(option.icon) && <Icon name={option.icon} />}
              <Text maxLines={2} render={<span />}>
                {option.label}
              </Text>
            </TogglePrimitive>
          )
        })}
      </ToggleGroupPrimitive>
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
    </div>
  )
}

export { ToggleGroup }
