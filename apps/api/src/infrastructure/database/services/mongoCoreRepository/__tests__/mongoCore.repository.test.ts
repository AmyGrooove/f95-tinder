import { describe, expect, it } from "@jest/globals"
import { Mongoose, Schema } from "mongoose"

import { MongoCoreRepository } from "../core/mongoCore.repository"

class TestRepository extends MongoCoreRepository<{ title: string }> {
  readConfiguration() {
    return { model: this.model, defaultSort: this.defaultSort }
  }
}

describe("MongoCoreRepository", () => {
  const model = new Mongoose().model(
    "TestRecord",
    new Schema({ title: { type: String, required: true } }),
  )

  it("предоставляет наследнику исходную модель и заданную сортировку", () => {
    const repository = new TestRepository(model, { defaultSort: { title: 1 } })

    const configuration = repository.readConfiguration()

    expect(configuration.model).toBe(model)
    expect(configuration.defaultSort).toStrictEqual({ title: 1 })
  })

  it.each([undefined, {}])(
    "оставляет сортировку неопределённой при настройках %p",
    (options) => {
      const repository = new TestRepository(model, options)

      expect(repository.readConfiguration().defaultSort).toBeUndefined()
    },
  )
})
