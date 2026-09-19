import { isString } from "@shared/functions/checks/isString"

import { CONFIG_ERROR_MESSAGES } from "../../../static/CONFIG_ERROR_MESSAGES"
import type { TEnvironmentKey } from "../../../types/TEnvironmentKey"

const getRequiredEnvironmentValue = (key: TEnvironmentKey) => {
  const value = process.env[key]

  if (!isString(value) || value.trim().length === 0) {
    throw new Error(
      `${CONFIG_ERROR_MESSAGES.MISSING_REQUIRED_ENVIRONMENT_VALUE}: ${key}`,
    )
  }

  return value.trim()
}

export { getRequiredEnvironmentValue }
