import type { Schema } from "mongoose"

import { isUndefined } from "@shared/functions/checks/isUndefined"

const applyTimestampsPlugin = (schema: Schema) => {
  if (isUndefined(schema.get("timestamps"))) {
    schema.set("timestamps", true)
  }
}

export { applyTimestampsPlugin }
