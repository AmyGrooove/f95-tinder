import type { Schema } from "mongoose"

import type { IReturnedObject } from "../types/IReturnedObject"
import { isNil } from "@shared/functions/checks/isNil"

const applyToJsonPlugin = (schema: Schema) => {
  const existingToJsonOptions = schema.get("toJSON")
  const existingTransform = existingToJsonOptions?.transform

  schema.set("versionKey", false)
  schema.set("toJSON", {
    ...existingToJsonOptions,
    virtuals: true,
    versionKey: false,
    transform: (document, returnedObject: IReturnedObject, options) => {
      const transformedObject =
        typeof existingTransform === "function"
          ? (existingTransform(
              document as Parameters<typeof existingTransform>[0],
              returnedObject as Parameters<typeof existingTransform>[1],
              options as Parameters<typeof existingTransform>[2],
            ) ?? returnedObject)
          : returnedObject

      if (!isNil(transformedObject._id)) {
        transformedObject.id = String(transformedObject._id)
      }

      delete transformedObject._id
      delete transformedObject.__v

      return transformedObject
    },
  })
}

export { applyToJsonPlugin }
