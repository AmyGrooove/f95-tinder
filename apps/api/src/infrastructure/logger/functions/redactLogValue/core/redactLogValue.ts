import { isArray } from "@shared/functions/checks/isArray"
import { isNil } from "@shared/functions/checks/isNil"
import { isObject } from "@shared/functions/checks/isObject"

const redactLogValue = (
  value: unknown,
  seen = new WeakSet<object>(),
): unknown => {
  if (typeof value === "bigint") {
    return value.toString()
  }

  if (isNil(value) || !isObject(value)) {
    return value
  }

  if (seen.has(value)) {
    return "[Circular]"
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  seen.add(value)

  if (isArray(value)) {
    return value.map((item) => redactLogValue(item, seen))
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      const normalizedKey = key.replace(/[_-]/g, "").toLowerCase()

      if (
        /password|token|authorization|cookie|secret|apikey/.test(normalizedKey)
      ) {
        return [key, "[REDACTED]"]
      }

      return [key, redactLogValue(item, seen)]
    }),
  )
}

export { redactLogValue }
