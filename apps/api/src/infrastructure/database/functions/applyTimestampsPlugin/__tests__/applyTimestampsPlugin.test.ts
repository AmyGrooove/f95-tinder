import { describe, expect, it } from "@jest/globals"
import { Schema } from "mongoose"

import { applyTimestampsPlugin } from "../core/applyTimestampsPlugin"

describe("applyTimestampsPlugin", () => {
  it("включает временные отметки, когда настройка отсутствует", () => {
    const schema = new Schema({ name: String })
    schema.plugin(applyTimestampsPlugin)

    expect(schema.get("timestamps")).toBe(true)
    expect(schema.path("createdAt")).toBeDefined()
    expect(schema.path("updatedAt")).toBeDefined()
  })

  it.each([true, false, { createdAt: "created", updatedAt: "updated" }])(
    "сохраняет явно заданную настройку %j",
    (timestamps) => {
      const schema = new Schema({}, { timestamps })
      schema.plugin(applyTimestampsPlugin)

      expect(schema.get("timestamps")).toEqual(timestamps)
    },
  )
})
