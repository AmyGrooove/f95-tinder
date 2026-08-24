import { CheckboxGroup } from '../../../core/CheckboxGroup'
import { useSingleCheckbox } from './useSingleCheckbox'
import type { ISingleCheckboxProps } from '../types/ISingleCheckboxProps'

const SingleCheckbox = (props: ISingleCheckboxProps) => {
  const {
    checkboxGroupValue,
    className,
    handleChange,
    hintText,
    isDisabled,
    options,
    ref,
  } = useSingleCheckbox(props)

  return (
    <CheckboxGroup
      className={className}
      hintText={hintText}
      isDisabled={isDisabled}
      onChange={handleChange}
      options={options}
      ref={ref}
      value={checkboxGroupValue}
    />
  )
}

export { SingleCheckbox }
