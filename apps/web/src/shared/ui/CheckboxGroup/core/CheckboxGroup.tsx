import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox'
import { isNil } from '@shared/functions/checks/isNil'
import { cn } from '@shared/functions/utility/cn'
import { Icon } from '@shared/ui/Icon'
import { Text } from '@shared/ui/Text'
import { useCheckboxGroup } from './useCheckboxGroup'
import st from './CheckboxGroup.module.scss'
import type { ICheckboxGroupProps } from '../types/ICheckboxGroupProps'

const CheckboxGroup = (props: ICheckboxGroupProps) => {
  const {
    className,
    handleCheckedChange,
    hintText,
    isDisabled,
    label,
    options,
    ref,
    value,
  } = useCheckboxGroup(props)

  return (
    <div className={cn(st.root, className)}>
      {!isNil(label) && (
        <Text maxLines={2} weight={700} render={<span />}>
          {label}
        </Text>
      )}
      <div className={st.options} ref={ref}>
        {options.map((option) => {
          const isOptionDisabled = option.isDisabled || isDisabled
          const isChecked = value.includes(option.value)

          return (
            <label
              className={cn(st.option, {
                [st.option_disabled]: isOptionDisabled,
              })}
              key={option.value}
            >
              <CheckboxPrimitive.Root
                checked={isChecked}
                className={st.checkbox}
                disabled={isOptionDisabled}
                onCheckedChange={(nextIsChecked) => {
                  handleCheckedChange(option.value, nextIsChecked)
                }}
              >
                <CheckboxPrimitive.Indicator className={st.indicator}>
                  <Icon name="check" />
                </CheckboxPrimitive.Indicator>
              </CheckboxPrimitive.Root>
              <Text maxLines={2} render={<span />}>
                {option.label}
              </Text>
            </label>
          )
        })}
      </div>
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

export { CheckboxGroup }
