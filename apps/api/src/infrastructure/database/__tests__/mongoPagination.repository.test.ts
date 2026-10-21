import { describe, expect, it, jest } from "@jest/globals"
import { Mongoose } from "mongoose"
import type { ClientSession } from "mongoose"

import { MongoPaginationRepository } from "../services/mongoPagination.repository"

describe("MongoPaginationRepository", () => {
  it.each([false, true])(
    "выполняет count последовательно только при session: %p",
    async (isSession) => {
      const mongoose = new Mongoose()
      const model = mongoose.model(
        "PaginationOrder",
        new mongoose.Schema({ key: String }),
      )
      const query = model.find()
      const countQuery = model.countDocuments()
      const items = [new model({ key: "one" })]
      let resolveItems: (value: typeof items) => void = () => {
        throw new Error("Запрос ещё не создан")
      }
      const pendingItems = new Promise<typeof items>((resolve) => {
        resolveItems = resolve
      })
      const executeItems = jest
        .spyOn(query, "exec")
        .mockReturnValue(pendingItems)
      const executeCount = jest.spyOn(countQuery, "exec").mockResolvedValue(1)
      jest.spyOn(model, "find").mockReturnValue(query)
      jest.spyOn(model, "countDocuments").mockReturnValue(countQuery)
      const session = isSession ? ({} as ClientSession) : undefined
      const repository = new MongoPaginationRepository(model)

      const result = repository.findManyPaginated({}, undefined, { session })

      expect(executeItems).toHaveBeenCalledTimes(1)
      expect(executeCount).toHaveBeenCalledTimes(isSession ? 0 : 1)
      expect(model.find).toHaveBeenCalledWith({}, undefined, {
        session,
        sort: undefined,
      })
      expect(countQuery.getOptions().session).toBe(session)
      resolveItems(items)
      await expect(result).resolves.toMatchObject({ items, total: 1 })
      expect(executeCount).toHaveBeenCalledTimes(1)
    },
  )
})
