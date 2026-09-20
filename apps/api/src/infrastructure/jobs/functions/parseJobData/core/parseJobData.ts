import { isArray } from "@shared/functions/checks/isArray"
import { isInt } from "@shared/functions/checks/isInt"
import { isObject } from "@shared/functions/checks/isObject"
import { isString } from "@shared/functions/checks/isString"

import type { IJobData } from "../../../types/IJobData"

const parseJobData = (value: unknown): IJobData => {
  if (
    !isObject(value) ||
    !("name" in value) ||
    !isString(value.name) ||
    value.name === "" ||
    !("version" in value) ||
    !isInt(value.version) ||
    value.version < 1 ||
    !("payload" in value) ||
    !("retryDelays" in value) ||
    !isArray(value.retryDelays) ||
    !value.retryDelays.every(
      (delay): delay is number => isInt(delay) && delay >= 0,
    ) ||
    !("cancellationState" in value) ||
    (value.cancellationState !== "none" &&
      value.cancellationState !== "cancelling" &&
      value.cancellationState !== "cancelled")
  ) {
    throw new Error("Invalid persisted job data")
  }

  return {
    name: value.name,
    version: value.version,
    payload: value.payload,
    retryDelays: value.retryDelays,
    cancellationState: value.cancellationState,
  }
}

export { parseJobData }
