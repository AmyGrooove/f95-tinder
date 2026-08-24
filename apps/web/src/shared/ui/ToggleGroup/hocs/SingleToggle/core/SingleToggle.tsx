import { ToggleGroup } from '../../../core/ToggleGroup'
import { useSingleToggle } from './useSingleToggle'
import type { ISingleToggleProps } from '../types/ISingleToggleProps'

const SingleToggle = (props: ISingleToggleProps) => {
  const {
    className,
    handleChange,
    hintText,
    isDisabled,
    options,
    ref,
    toggleGroupValue,
  } = useSingleToggle(props)

  return (
    <ToggleGroup
      className={className}
      hintText={hintText}
      isDisabled={isDisabled}
      onChange={handleChange}
      options={options}
      ref={ref}
      value={toggleGroupValue}
    />
  )
}

export { SingleToggle }
