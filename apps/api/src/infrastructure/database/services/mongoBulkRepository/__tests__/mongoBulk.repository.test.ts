import { describe, expect, it, jest } from "@jest/globals"
import type { Model } from "mongoose"

import { MongoBulkRepository } from "../core/mongoBulk.repository"

describe("MongoBulkRepository", () => {
  it.each([undefined, false])(
    "сохраняет настройку массовой валидации %j",
    async (isValidationEnabled) => {
      const result = { matchedCount: 2, modifiedCount: 2 }
      const exec = jest.fn(async () => result)
      const setOptions = jest.fn(() => ({ exec }))
      const updateMany = jest.fn(() => ({ setOptions }))
      const repository = new MongoBulkRepository({
        updateMany,
      } as unknown as Model<unknown>)
      const filter = { title: "Книга" }
      const update = { $set: { title: "Новое название" } }
      const options = { runValidators: isValidationEnabled }

      await expect(
        repository.updateMany(filter, update, options),
      ).resolves.toBe(result)
      expect(updateMany.mock.calls).toEqual([[filter, update, options]])
      expect(setOptions.mock.calls).toEqual([
        [{ runValidators: isValidationEnabled ?? true }],
      ])
    },
  )
})
