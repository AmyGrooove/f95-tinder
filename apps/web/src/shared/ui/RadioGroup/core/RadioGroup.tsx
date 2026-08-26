import { Radio } from '@base-ui/react/radio'
import { RadioGroup as RadioGroupPrimitive } from '@base-ui/react/radio-group'
import { isNil } from '@shared/functions/checks/isNil'
import { cn } from '@shared/functions/utility/cn'
import { Text } from '@shared/ui/Text'
import { useRadioGroup } from './useRadioGroup'
import st from './RadioGroup.module.scss'
import type { IRadioGroupProps } from '../types/IRadioGroupProps'

const RadioGroup = (props: IRadioGroupProps) => {
  const {
    className,
    handleValueChange,
    hintText,
    isDisabled,
    label,
    options,
    ref,
    value,
  } = useRadioGroup(props)

  return (
    <div className={cn(st.root, className)}>
      {!isNil(label) && (
        <Text maxLines={2} weight={700} render={<span />}>
          {label}
        </Text>
      )}
      <RadioGroupPrimitive
        className={st.options}
        disabled={isDisabled}
        onValueChange={handleValueChange}
        ref={ref}
        value={value}
      >
        {options.map((option) => {
          return (
            <label
              className={cn(st.option, {
                [st.option_disabled]:
                  (!isNil(option.isDisabled) && option.isDisabled) || isDisabled,
              })}
              key={option.value}
            >
              <Radio.Root
                className={st.radio}
                disabled={option.isDisabled}
                value={option.value}
              >
                <Radio.Indicator className={st.indicator} />
              </Radio.Root>
              <Text maxLines={2} render={<span />}>
                {option.label}
              </Text>
            </label>
          )
        })}
      </RadioGroupPrimitive>
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

export { RadioGroup }
