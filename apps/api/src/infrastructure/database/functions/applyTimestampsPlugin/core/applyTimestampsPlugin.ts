import type { Schema } from "mongoose"

const applyTimestampsPlugin = (schema: Schema) => {
  schema.set("timestamps", true)
}

export { applyTimestampsPlugin }
