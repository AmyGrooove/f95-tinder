import { isObject } from "@shared/functions/checks/isObject"
import { isString } from "@shared/functions/checks/isString"

const getHttpExceptionMessage = (
  response: unknown,
  fallbackMessage: string,
) => {
  if (isString(response)) {
    return response
  }

  if (
    isObject(response) &&
    "message" in response &&
    isString(response.message)
  ) {
    return response.message
  }

  return fallbackMessage
}

export { getHttpExceptionMessage }
