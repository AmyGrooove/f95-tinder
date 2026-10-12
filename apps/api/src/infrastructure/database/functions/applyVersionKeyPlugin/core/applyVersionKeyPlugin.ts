import type { Schema } from "mongoose"

const applyVersionKeyPlugin = (schema: Schema) => {
  schema.set("versionKey", false)
}

export { applyVersionKeyPlugin }
