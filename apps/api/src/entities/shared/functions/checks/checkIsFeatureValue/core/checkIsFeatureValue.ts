import { isFiniteNumber } from "@shared/functions/checks/isFiniteNumber"
import { isString } from "@shared/functions/checks/isString"
import { isBoolean } from "@shared/functions/checks/isBoolean"
import { isDate } from "@shared/functions/checks/isDate"

const checkIsFeatureValue = (value: unknown) => {
  return (
    isFiniteNumber(value) ||
    isString(value) ||
    isBoolean(value) ||
    isDate(value)
  )
}

export { checkIsFeatureValue }
