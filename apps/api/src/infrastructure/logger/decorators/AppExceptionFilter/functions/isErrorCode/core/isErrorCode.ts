import { isString } from "@shared/functions/checks/isString"

import { ERROR_CODES } from "../../../static/ERROR_CODES"
import type { TErrorCode } from "../../../types/TErrorCode"

const isErrorCode = (value: unknown): value is TErrorCode => {
  if (!isString(value)) {
    return false
  }

  return Object.values(ERROR_CODES).includes(value as TErrorCode)
}

export { isErrorCode }
