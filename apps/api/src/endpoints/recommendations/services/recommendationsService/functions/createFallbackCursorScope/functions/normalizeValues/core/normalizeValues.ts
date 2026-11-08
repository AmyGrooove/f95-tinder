import type { Types } from "mongoose"

const normalizeValues = (values: readonly (string | Types.ObjectId)[]) => {
  return [...new Set(values.map(String))].sort()
}

export { normalizeValues }
