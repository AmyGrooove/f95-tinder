import { isArray } from "@shared/functions/checks/isArray"
import { isObject } from "@shared/functions/checks/isObject"
import { isString } from "@shared/functions/checks/isString"

import type { TNormalizedError } from "../../../types/TNormalizedError"

const normalizeError = (error: unknown): TNormalizedError => {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    }
  }

  if (isString(error)) {
    return {
      message: error,
    }
  }

  if (isArray(error)) {
    return {
      message: "Unknown error",
      details: error,
    }
  }

  if (isObject(error)) {
    return {
      message: "Unknown error",
      details: Object.fromEntries(Object.entries(error)),
    }
  }

  return {
    message: "Unknown error",
  }
}

export { normalizeError }
