import { isArray } from "@shared/functions/checks/isArray"
import { isString } from "@shared/functions/checks/isString"

const checkIsNonEmptyStringArray = (value: unknown) => {
  return (
    isArray(value) &&
    value.every((entry) => isString(entry) && entry.trim().length > 0)
  )
}

export { checkIsNonEmptyStringArray }
