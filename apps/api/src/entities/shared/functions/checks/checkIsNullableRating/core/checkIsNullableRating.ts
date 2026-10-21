import { isInt } from "@shared/functions/checks/isInt"
import { isNil } from "@shared/functions/checks/isNil"

const checkIsNullableRating = (value: unknown) => {
  return isNil(value) || (isInt(value) && value >= 1 && value <= 10)
}

export { checkIsNullableRating }
