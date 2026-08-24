import type { Schema } from "mongoose"

const applyTimestampsPlugin = (schema: Schema): void => {
  schema.set("timestamps", true)
}

export { applyTimestampsPlugin }
