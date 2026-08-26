import { isObject } from "@shared/functions/isObject"
import { isString } from "@shared/functions/isString"

import type { IJobProgress } from "../../../types/IJobProgress"

const normalizeJobProgress = (value: unknown): IJobProgress => {
  if (!isObject(value)) {
    return { progress: 0 }
  }

  const candidate = value as Partial<IJobProgress>

  return {
    executionState: candidate.executionState,
    progress:
      typeof candidate.progress === "number" &&
      Number.isInteger(candidate.progress) &&
      candidate.progress >= 0 &&
      candidate.progress <= 100
        ? candidate.progress
        : 0,
    status: isString(candidate.status) ? candidate.status : undefined,
  }
}

export { normalizeJobProgress }
