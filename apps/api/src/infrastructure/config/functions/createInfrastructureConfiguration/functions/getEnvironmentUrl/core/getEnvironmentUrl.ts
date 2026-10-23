import { getRequiredEnvironmentValue } from "../../getRequiredEnvironmentValue"

import { CONFIG_ERROR_MESSAGES } from "../../../static/CONFIG_ERROR_MESSAGES"
import type { TEnvironmentKey } from "../../../types/TEnvironmentKey"

const getEnvironmentUrl = (key: TEnvironmentKey, protocols: string[]) => {
  let url: URL

  try {
    url = new URL(getRequiredEnvironmentValue(key))
  } catch {
    throw new Error(`${CONFIG_ERROR_MESSAGES.INVALID_ENVIRONMENT_URL}: ${key}`)
  }

  if (!protocols.includes(url.protocol)) {
    throw new Error(`${CONFIG_ERROR_MESSAGES.INVALID_URL_PROTOCOL}: ${key}`)
  }

  return url
}

export { getEnvironmentUrl }
