import { describe, expect, it } from "@jest/globals"
import { Mongoose, Schema } from "mongoose"

import { applyVersionKeyPlugin } from "../core/applyVersionKeyPlugin"

describe("applyVersionKeyPlugin", () => {
  it.each<string | false | undefined>([undefined, false, "revision"])(
    "отключает ключ версии при исходной настройке %s",
    (versionKey) => {
      const schema = new Schema({ name: String }, { versionKey })
      schema.plugin(applyVersionKeyPlugin)
      const Model = new Mongoose().model("Record", schema)

      expect(schema.get("versionKey")).toBe(false)
      expect(new Model({ name: "value" }).toObject()).not.toHaveProperty("__v")
      expect(schema.path("revision")).toBeUndefined()
    },
  )
})
