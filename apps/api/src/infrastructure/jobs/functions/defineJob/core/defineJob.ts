import { isInt } from "@shared/functions/checks/isInt"

import type { IJobDefinition } from "../../../types/IJobDefinition"
import type { IJobDefinitionOptions } from "../../../types/IJobDefinitionOptions"

const defineJob = <TPayload>(
  name: string,
  options?: IJobDefinitionOptions,
): IJobDefinition<TPayload> => {
  const version = options?.version ?? 1
  const retryDelays = options?.retryDelays ?? []

  if (name.trim() === "" || !isInt(version) || version < 1) {
    throw new Error("Job name and version must be valid")
  }

  if (retryDelays.some((delay) => !isInt(delay) || delay < 0)) {
    throw new Error("Job retry delays must be non-negative integers")
  }

  return { name, version, retryDelays: [...retryDelays] }
}

export { defineJob }
