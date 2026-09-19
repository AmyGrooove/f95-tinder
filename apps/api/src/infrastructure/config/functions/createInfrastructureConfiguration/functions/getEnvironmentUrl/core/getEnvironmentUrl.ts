import { isNil } from "@shared/functions/checks/isNil"

import { CONFIG_ERROR_MESSAGES } from "../../../static/CONFIG_ERROR_MESSAGES"
import type { TEnvironmentKey } from "../../../types/TEnvironmentKey"
import { getRequiredEnvironmentValue } from "../../getRequiredEnvironmentValue"

const getEnvironmentUrl = (key: TEnvironmentKey, protocols: string[]) => {
  let url: URL | undefined

  try {
    url = new URL(getRequiredEnvironmentValue(key))
  } catch {
    throw new Error(`${CONFIG_ERROR_MESSAGES.INVALID_ENVIRONMENT_URL}: ${key}`)
  }

  if (isNil(url) || !protocols.includes(url.protocol)) {
    throw new Error(`${CONFIG_ERROR_MESSAGES.INVALID_URL_PROTOCOL}: ${key}`)
  }

  return url
}

export { getEnvironmentUrl }
