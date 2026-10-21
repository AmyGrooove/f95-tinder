import { isArray } from "@shared/functions/checks/isArray"
import { isNil } from "@shared/functions/checks/isNil"

const checkIsArrayWithoutNil = (value: unknown) => {
  return isArray(value) && value.every((entry) => !isNil(entry))
}

export { checkIsArrayWithoutNil }
