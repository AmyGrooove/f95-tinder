import { describe, expect, it, jest } from "@jest/globals"
import type { Model } from "mongoose"

import { MongoReadRepository } from "../core/mongoRead.repository"

describe("MongoReadRepository", () => {
  it("использует сортировку репозитория только без явной сортировки запроса", async () => {
    const sort = jest.fn()
    const exec = jest.fn(async () => [{ title: "Книга" }])
    const find = jest.fn(() => ({ sort, exec }))
    const repository = new MongoReadRepository(
      { find } as unknown as Model<{ title: string }>,
      {
        defaultSort: { title: 1 },
      },
    )

    await expect(repository.findMany({})).resolves.toEqual([{ title: "Книга" }])
    expect(sort).toHaveBeenCalledWith({ title: 1 })

    sort.mockClear()
    await repository.findMany({}, undefined, { sort: { title: -1 } })
    expect(sort).not.toHaveBeenCalled()
    expect(find.mock.lastCall).toEqual([{}, undefined, { sort: { title: -1 } }])
  })
})
