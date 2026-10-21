import { describe, expect, it } from "@jest/globals"
import { Mongoose, Schema } from "mongoose"

import { applyToJsonPlugin } from "../core/applyToJsonPlugin"

describe("applyToJsonPlugin", () => {
  it("преобразует _id в строковый id, удаляет __v и включает виртуальные поля", () => {
    const schema = new Schema({ name: String }, { toJSON: { minimize: false } })
    schema.virtual("label").get(() => "virtual-value")
    schema.plugin(applyToJsonPlugin)
    const Model = new Mongoose().model("Record", schema)
    const document = new Model({ name: "value", __v: 3 })

    expect(document.toJSON()).toStrictEqual({
      name: "value",
      id: document._id.toString(),
      label: "virtual-value",
    })
    expect(schema.get("toJSON")?.minimize).toBe(false)
    expect(document._id).toBeDefined()
    expect(document.__v).toBe(3)
  })

  it("обрабатывает документ без идентификатора", () => {
    const schema = new Schema({ name: String }, { _id: false, id: false })
    schema.plugin(applyToJsonPlugin)
    const Model = new Mongoose().model("Record", schema)

    expect(new Model({ name: "value" }).toJSON()).toStrictEqual({
      name: "value",
    })
  })

  it("применяет существующий transform до очистки служебных полей", () => {
    const schema = new Schema(
      { name: String },
      {
        toJSON: {
          transform: (_document, returned) => ({
            _id: returned._id,
            __v: 7,
            label: "custom",
          }),
        },
      },
    )
    schema.plugin(applyToJsonPlugin)
    const Model = new Mongoose().model("Record", schema)
    const document = new Model({ name: "value" })

    expect(document.toJSON()).toStrictEqual({
      id: document._id.toString(),
      label: "custom",
    })
  })

  it("сохраняет изменения transform, возвращающего undefined", () => {
    const schema = new Schema(
      { name: String },
      {
        toJSON: {
          transform: (_document, returned) => {
            returned.name = "changed"
          },
        },
      },
    )
    schema.plugin(applyToJsonPlugin)
    const Model = new Mongoose().model("Record", schema)
    const document = new Model({ name: "value" })

    expect(document.toJSON()).toStrictEqual({
      id: document._id.toString(),
      name: "changed",
    })
  })
})
