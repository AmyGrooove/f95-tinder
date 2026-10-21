import { isInt } from "@shared/functions/checks/isInt"
import { isNonNegativeSafe } from "@shared/functions/checks/isNonNegativeSafe"

const checkIsNonNegativeSafeInteger = (value: unknown) => {
  return isInt(value) && isNonNegativeSafe(value)
}

export { checkIsNonNegativeSafeInteger }
