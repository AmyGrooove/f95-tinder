import { describe, expect, it, jest } from "@jest/globals"
import type { Model } from "mongoose"

import { MongoWriteRepository } from "../core/mongoWrite.repository"

describe("MongoWriteRepository", () => {
  it.each([
    [{}, { returnDocument: "after", runValidators: true }],
    [{ new: false }, { returnDocument: "before", runValidators: true }],
    [
      { new: false, returnDocument: "after", runValidators: false },
      { returnDocument: "after", runValidators: false },
    ],
  ] as const)(
    "применяет настройки обновления %j",
    async (options, expected) => {
      const exec = jest.fn(async () => null)
      const setOptions = jest.fn(() => ({ exec }))
      const findByIdAndUpdate = jest.fn(() => ({ setOptions, exec }))
      const findOneAndUpdate = jest.fn(() => ({ setOptions }))
      const repository = new MongoWriteRepository({
        findByIdAndUpdate,
        findOneAndUpdate,
      } as unknown as Model<unknown>)

      await expect(repository.updateById("id", {}, options)).resolves.toBeNull()
      await expect(
        repository.updateByFilter({}, {}, options),
      ).resolves.toBeNull()
      expect(setOptions.mock.calls).toEqual([[expected], [expected]])
      expect(exec).toHaveBeenCalledTimes(2)
    },
  )
})
