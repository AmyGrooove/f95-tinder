import type { Schema } from "mongoose"

const applyTimestampsPlugin = (schema: Schema) => {
  if (schema.get("timestamps") === undefined) {
    schema.set("timestamps", true)
  }
}

export { applyTimestampsPlugin }
