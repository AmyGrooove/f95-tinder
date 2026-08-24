import { isArray } from "@shared/functions/isArray"
import { isObject } from "@shared/functions/isObject"

const normalizeMultipartFields = (
  fields: Record<string, unknown>,
): Record<string, unknown> => {
  return Object.fromEntries(
    Object.entries(fields).map(([field, value]) => {
      if (isArray(value)) {
        return [
          field,
          value.map((item) => {
            if (isObject(item) && "value" in item) {
              return item.value
            }

            return item
          }),
        ]
      }

      if (isObject(value) && "value" in value) {
        return [field, value.value]
      }

      return [field, value]
    }),
  )
}

export { normalizeMultipartFields }
