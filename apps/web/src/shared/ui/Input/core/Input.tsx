import { Input as InputPrimitive } from '@base-ui/react/input'
import { isNil } from '@shared/functions/checks/isNil'
import { cn } from '@shared/functions/utility/cn'
import { Icon } from '@shared/ui/Icon'
import { Text } from '@shared/ui/Text'
import { useInput } from './useInput'
import st from './Input.module.scss'
import type { IInputProps } from '../types/IInputProps'

const Input = (props: IInputProps) => {
  const {
    className,
    handleChange,
    icon,
    isDisabled,
    isError,
    label,
    messageText,
    onBlur,
    onFocus,
    placeholder,
    ref,
    type,
    value,
  } = useInput(props)

  return (
    <label
      className={cn(st.root, className, {
        [st.root_disabled]: isDisabled,
        [st.root_error]: isError,
      })}
    >
      {!isNil(label) && (
        <Text maxLines={2} weight={700} render={<span />}>
          {label}
        </Text>
      )}
      <span className={st.control}>
        {!isNil(icon) && <Icon name={icon} className={st.icon} />}
        <InputPrimitive
          className={st.input}
          disabled={isDisabled}
          onBlur={onBlur}
          onFocus={onFocus}
          onValueChange={handleChange}
          placeholder={placeholder}
          ref={ref}
          type={type}
          value={value}
        />
      </span>
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
    </label>
  )
}

export { Input }
