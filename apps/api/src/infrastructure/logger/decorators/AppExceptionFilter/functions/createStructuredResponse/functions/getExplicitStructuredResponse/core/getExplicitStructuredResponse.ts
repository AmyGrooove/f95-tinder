import { isArray } from "@shared/functions/checks/isArray"
import { isNil } from "@shared/functions/checks/isNil"
import { isObject } from "@shared/functions/checks/isObject"
import { isString } from "@shared/functions/checks/isString"

import { ERROR_CODES } from "../../../../../static/ERROR_CODES"
import type { IStructuredExceptionResponse } from "../../../../../types/IStructuredExceptionResponse"
import type { TErrorCode } from "../../../../../types/TErrorCode"

const getExplicitStructuredResponse = (
  response: object,
): IStructuredExceptionResponse | undefined => {
  if (!("code" in response) || !("message" in response)) {
    return undefined
  }

  const { code, message } = response

  if (!isString(code) || !isString(message)) {
    return undefined
  }

  const knownCode = Object.values(ERROR_CODES).find((value) => value === code)
  const errorCode: TErrorCode | undefined =
    knownCode ??
    (/^HTTP_\d+$/.test(code) ? (code as `HTTP_${number}`) : undefined)

  if (isNil(errorCode)) {
    return undefined
  }

  const details = "details" in response ? response.details : null

  if (isArray(details)) {
    return { code: errorCode, message, details: { errors: details } }
  }

  if (isObject(details)) {
    return {
      code: errorCode,
      message,
      details: Object.fromEntries(Object.entries(details)),
    }
  }

  return { code: errorCode, message, details: null }
}

export { getExplicitStructuredResponse }
