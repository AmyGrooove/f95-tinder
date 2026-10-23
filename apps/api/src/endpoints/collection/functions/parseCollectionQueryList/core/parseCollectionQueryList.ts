import { isArray } from "@shared/functions/checks/isArray"
import { isString } from "@shared/functions/checks/isString"

const parseCollectionQueryList = (value: unknown) => {
  const entries = isArray(value) ? value : [value]

  return entries.flatMap((entry: unknown) => {
    return isString(entry)
      ? entry.split(",").map((part) => part.trim())
      : [entry]
  })
}

export { parseCollectionQueryList }
