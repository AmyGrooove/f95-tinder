import { isInt } from "@shared/functions/checks/isInt"
import { isObject } from "@shared/functions/checks/isObject"
import { isString } from "@shared/functions/checks/isString"

const normalizeJobProgress = (value: unknown) => {
  if (!isObject(value)) {
    return { progress: 0 }
  }

  const progress = "progress" in value ? value.progress : undefined
  const status = "status" in value ? value.status : undefined

  return {
    progress:
      isInt(progress) && progress >= 0 && progress <= 100 ? progress : 0,
    status: isString(status) ? status : undefined,
  }
}

export { normalizeJobProgress }
