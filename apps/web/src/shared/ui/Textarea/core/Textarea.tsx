import { Input as InputPrimitive } from '@base-ui/react/input'
import { isNil } from '@shared/functions/checks/isNil'
import { cn } from '@shared/functions/utility/cn'
import { Text } from '@shared/ui/Text'
import { useTextarea } from './useTextarea'
import st from './Textarea.module.scss'
import type { ITextareaProps } from '../types/ITextareaProps'

const Textarea = (props: ITextareaProps) => {
  const {
    className,
    handleValueChange,
    isDisabled,
    isError,
    label,
    messageText,
    mergedTextareaRef,
    onBlur,
    onFocus,
    placeholder,
    value,
  } = useTextarea(props)

  return (
    <label
      className={cn(st.root, className, {
        [st.root_disabled]: isDisabled,
        [st.root_error]: isError,
      })}
    >
      {!isNil(label) && (
        <Text maxLines={2} render={<span />}>
          {label}
        </Text>
      )}
      <span className={st.control}>
        <InputPrimitive
          disabled={isDisabled}
          onValueChange={handleValueChange}
          placeholder={placeholder}
          render={
            <textarea
              className={st.textarea}
              onBlur={onBlur}
              onFocus={onFocus}
              ref={mergedTextareaRef}
              rows={4}
            />
          }
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

export { Textarea }
