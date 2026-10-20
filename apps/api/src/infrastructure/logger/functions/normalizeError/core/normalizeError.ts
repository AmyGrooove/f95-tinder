import { isArray } from "@shared/functions/checks/isArray"
import { isObject } from "@shared/functions/checks/isObject"
import { isString } from "@shared/functions/checks/isString"

import type { INormalizedError } from "../../../types/INormalizedError"
import { DICTIONARY } from "@shared/static/DICTIONARY"

const normalizeError = (error: unknown): INormalizedError => {
  if (error instanceof Error) {
    return {
      message: error.message,
      details: null,
      name: error.name,
      stack: error.stack,
    }
  }

  if (isString(error)) {
    return {
      message: error,
      details: null,
    }
  }

  if (isArray(error)) {
    return {
      message: DICTIONARY.logger.unknownError,
      details: { errors: error },
    }
  }

  if (isObject(error)) {
    return {
      message: DICTIONARY.logger.unknownError,
      details: Object.fromEntries(Object.entries(error)),
    }
  }

  return {
    message: DICTIONARY.logger.unknownError,
    details: null,
  }
}

export { normalizeError }
