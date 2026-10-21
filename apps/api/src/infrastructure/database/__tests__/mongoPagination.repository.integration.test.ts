import { beforeAll, beforeEach, describe, expect, it } from "@jest/globals"
import { Types } from "mongoose"

import { MongoPaginationRepository } from "../services/mongoPagination.repository"
import { createRepositoryFixture } from "./functions/createRepositoryFixture"

describe("MongoPaginationRepository", () => {
  let fixture: Awaited<ReturnType<typeof createRepositoryFixture>>

  beforeAll(async () => {
    fixture = await createRepositoryFixture("RepositoryPaginationTest")
  })

  beforeEach(async () => {
    await fixture.model.create([
      {
        _id: new Types.ObjectId("000000000000000000000001"),
        key: "one",
        score: 1,
      },
      {
        _id: new Types.ObjectId("000000000000000000000002"),
        key: "two",
        score: 2,
      },
      {
        _id: new Types.ObjectId("000000000000000000000003"),
        key: "three",
        score: 2,
      },
      {
        _id: new Types.ObjectId("000000000000000000000004"),
        key: "four",
        score: 3,
        group: "second",
      },
    ])
  })

  it("возвращает страницу, total и признаки соседних страниц", async () => {
    const result = await fixture.pagination.findManyPaginated(
      {},
      undefined,
      undefined,
      { page: 2, limit: 2 },
    )

    expect(result).toMatchObject({
      page: 2,
      limit: 2,
      total: 4,
      pages: 2,
      isNextPage: false,
      isPreviousPage: true,
    })
    expect(result.items.map(({ key }) => key)).toEqual(["two", "one"])
  })

  it("считает total по фильтру независимо от размера страницы и применяет projection", async () => {
    const result = await fixture.pagination.findManyPaginated(
      { group: "first" },
      { key: 1, _id: 0 },
      { lean: true },
      { limit: 1 },
    )

    expect(result).toMatchObject({
      total: 3,
      pages: 3,
      isNextPage: true,
      isPreviousPage: false,
    })
    expect(result.items).toEqual([{ key: "three" }])
  })

  it.each([undefined, {}, "", "   "])(
    "использует defaultSort при пустой сортировке %p",
    async (sort) => {
      const result = await fixture.pagination.findManyPaginated({}, undefined, {
        sort,
      })

      expect(result.items.map(({ key }) => key)).toEqual([
        "four",
        "three",
        "two",
        "one",
      ])
      expect(result).toMatchObject({ page: 1, limit: 20 })
    },
  )

  it.each([
    { score: 1 as const },
    "score",
    [["score", "asc"]] as [string, "asc"][],
  ])(
    "учитывает пользовательскую сортировку %p и добавляет _id",
    async (sort) => {
      const result = await fixture.pagination.findManyPaginated({}, undefined, {
        sort,
      })

      expect(result.items.map(({ key }) => key)).toEqual([
        "one",
        "three",
        "two",
        "four",
      ])
    },
  )

  it("сохраняет явно заданное направление _id", async () => {
    const result = await fixture.pagination.findManyPaginated({}, undefined, {
      sort: { score: 1, _id: 1 },
    })

    expect(result.items.map(({ key }) => key)).toEqual([
      "one",
      "two",
      "three",
      "four",
    ])
  })

  it("сортирует по _id при отсутствии defaultSort", async () => {
    const repository = new MongoPaginationRepository(fixture.model)
    const result = await repository.findManyPaginated({})

    expect(result.items.map(({ key }) => key)).toEqual([
      "four",
      "three",
      "two",
      "one",
    ])
  })

  it("возвращает пустую страницу без потери total", async () => {
    const result = await fixture.pagination.findManyPaginated(
      {},
      undefined,
      undefined,
      { page: 10, limit: 2 },
    )

    expect(result).toMatchObject({
      items: [],
      total: 4,
      pages: 2,
      page: 10,
      isNextPage: false,
      isPreviousPage: true,
    })
    expect(
      await fixture.pagination.findManyPaginated({ key: "missing" }),
    ).toMatchObject({
      items: [],
      total: 0,
      pages: 0,
      isNextPage: false,
      isPreviousPage: false,
    })
  })

  it("нормализует некорректные и ограничивает слишком большие параметры", async () => {
    expect(
      await fixture.pagination.findManyPaginated({}, undefined, undefined, {
        page: -2,
        limit: 0,
      }),
    ).toMatchObject({ page: 1, limit: 1 })
    expect(
      await fixture.pagination.findManyPaginated({}, undefined, undefined, {
        page: 2.9,
        limit: 1000,
      }),
    ).toMatchObject({ page: 2, limit: 100 })
  })
})
