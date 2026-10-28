import { Select as SelectPrimitive } from '@base-ui/react/select'
import { isNil } from '@shared/functions/checks/isNil'
import { cn } from '@shared/functions/utility/cn'
import { Icon } from '@shared/ui/Icon'
import { Text } from '@shared/ui/Text'
import { useSelect } from './useSelect'
import st from './Select.module.scss'
import type { ISelectProps } from '../types/ISelectProps'

const Select = (props: ISelectProps) => {
  const {
    className,
    handleChange,
    handleClear,
    icon,
    isClearButtonVisible,
    isDisabled,
    isError,
    label,
    messageText,
    options,
    placeholder,
    ref,
    value,
  } = useSelect(props)

  return (
    <div
      className={cn(st.root, className, {
        [st.root_disabled]: isDisabled,
        [st.root_error]: isError,
      })}
    >
      <SelectPrimitive.Root
        disabled={isDisabled}
        items={options}
        onValueChange={handleChange}
        value={value}
      >
        {!isNil(label) && (
          <SelectPrimitive.Label>
            <Text maxLines={2} weight={700} render={<span />}>
              {label}
            </Text>
          </SelectPrimitive.Label>
        )}
        <div
          className={cn(st.control, {
            [st.control_clearable]: isClearButtonVisible,
          })}
        >
          <SelectPrimitive.Trigger className={st.trigger} ref={ref}>
            {!isNil(icon) && <Icon className={st.icon} name={icon} />}
            <SelectPrimitive.Value
              className={st.value}
              placeholder={placeholder}
            />
            <SelectPrimitive.Icon className={st.indicatorIcon}>
              <Icon name="chevronDown" />
            </SelectPrimitive.Icon>
          </SelectPrimitive.Trigger>
          {isClearButtonVisible && (
            <button
              className={st.clearButton}
              disabled={isDisabled}
              onClick={handleClear}
              type="button"
            >
              <Icon name="x" />
            </button>
          )}
        </div>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Positioner
            alignItemWithTrigger={false}
            className={st.positioner}
            sideOffset={8}
          >
            <SelectPrimitive.Popup className={st.popup}>
              <SelectPrimitive.List className={st.list}>
                {options.map((option) => {
                  return (
                    <SelectPrimitive.Item
                      className={st.item}
                      disabled={option.isDisabled}
                      key={option.value}
                      value={option.value}
                    >
                      <SelectPrimitive.ItemText className={st.itemText}>
                        {option.label}
                      </SelectPrimitive.ItemText>
                    </SelectPrimitive.Item>
                  )
                })}
              </SelectPrimitive.List>
            </SelectPrimitive.Popup>
          </SelectPrimitive.Positioner>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
      {!isNil(messageText) && (
        <Text
          className={st.hintText}
          fontSize={12}
          maxLines={2}
          render={<span />}
        >
          {messageText}
        </Text>
      )}
    </div>
  )
}

export { Select }
