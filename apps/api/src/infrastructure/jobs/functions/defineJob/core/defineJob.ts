import { isInt } from "@shared/functions/checks/isInt"

import type { IJobDefinition } from "../../../types/IJobDefinition"
import type { IJobDefinitionOptions } from "../../../types/IJobDefinitionOptions"
import { DICTIONARY } from "@shared/static/DICTIONARY"

const defineJob = <TPayload>(
  name: string,
  options?: IJobDefinitionOptions,
): IJobDefinition<TPayload> => {
  const version = options?.version ?? 1
  const retryDelays = options?.retryDelays ?? []

  if (name.trim() === "" || !isInt(version) || version < 1) {
    throw new Error(DICTIONARY.jobs.invalidDefinition)
  }

  if (retryDelays.some((delay) => !isInt(delay) || delay < 0)) {
    throw new Error(DICTIONARY.jobs.invalidRetryDelays)
  }

  return { name, version, retryDelays: [...retryDelays] }
}

export { defineJob }
