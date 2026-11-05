import { beforeAll, beforeEach, describe, expect, it } from "@jest/globals"
import { Types } from "mongoose"

import type { TPageSize } from "../../../types/TPageSize"

import { MongoPaginationRepository } from "../core/mongoPagination.repository"
import { createRepositoryFixture } from "../../../__tests__/functions/createRepositoryFixture"

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
      ...Array.from({ length: 8 }, (_, index) => ({
        _id: new Types.ObjectId((index + 5).toString(16).padStart(24, "0")),
        key: `extra-${index + 1}`,
        score: 0,
      })),
    ])
  })

  it("возвращает страницу, total и признаки соседних страниц", async () => {
    const result = await fixture.pagination.findManyPaginated(
      {},
      undefined,
      undefined,
      { page: 2, limit: 10 },
    )

    expect(result).toMatchObject({
      page: 2,
      total: 12,
      pages: 2,
      isNextPage: false,
      isPreviousPage: true,
    })
    expect(result.items.map(({ key }) => key)).toEqual(["extra-2", "extra-1"])
  })

  it("считает total по фильтру независимо от размера страницы и применяет projection", async () => {
    const result = await fixture.pagination.findManyPaginated(
      { group: "first" },
      { key: 1, _id: 0 },
      { lean: true },
      { limit: 10 },
    )

    expect(result).toMatchObject({
      total: 11,
      pages: 2,
      isNextPage: true,
      isPreviousPage: false,
    })
    expect(result.items).toEqual([
      { key: "three" },
      { key: "two" },
      { key: "one" },
      ...Array.from({ length: 7 }, (_, index) => ({
        key: `extra-${8 - index}`,
      })),
    ])
  })

  it.each([undefined, {}, "", "   "])(
    "использует defaultSort при пустой сортировке %p",
    async (sort) => {
      const result = await fixture.pagination.findManyPaginated(
        { score: { $gt: 0 } },
        undefined,
        {
          sort,
        },
      )

      expect(result.items.map(({ key }) => key)).toEqual([
        "four",
        "three",
        "two",
        "one",
      ])
      expect(result).toMatchObject({ page: 1, pages: 1 })
    },
  )

  it.each([
    { score: 1 as const },
    "score",
    [["score", "asc"]] as [string, "asc"][],
  ])(
    "учитывает пользовательскую сортировку %p и добавляет _id",
    async (sort) => {
      const result = await fixture.pagination.findManyPaginated(
        { score: { $gt: 0 } },
        undefined,
        {
          sort,
        },
      )

      expect(result.items.map(({ key }) => key)).toEqual([
        "one",
        "three",
        "two",
        "four",
      ])
    },
  )

  it("сохраняет явно заданное направление _id", async () => {
    const result = await fixture.pagination.findManyPaginated(
      { score: { $gt: 0 } },
      undefined,
      {
        sort: { score: 1, _id: 1 },
      },
    )

    expect(result.items.map(({ key }) => key)).toEqual([
      "one",
      "two",
      "three",
      "four",
    ])
  })

  it("сортирует по _id при отсутствии defaultSort", async () => {
    const repository = new MongoPaginationRepository(fixture.model)
    const result = await repository.findManyPaginated({ score: { $gt: 0 } })

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
      { page: 10, limit: 10 },
    )

    expect(result).toMatchObject({
      items: [],
      total: 12,
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

  it("нормализует страницу и использует стандартный размер для неподдерживаемых значений", async () => {
    expect(
      await fixture.pagination.findManyPaginated({}, undefined, undefined, {
        page: -2,
        limit: 0 as TPageSize,
      }),
    ).toMatchObject({ page: 1, total: 12, pages: 1, items: expect.any(Array) })
    expect(
      await fixture.pagination.findManyPaginated({}, undefined, undefined, {
        page: 2.9,
        limit: 1000 as TPageSize,
      }),
    ).toMatchObject({ page: 2, total: 12, pages: 1, items: [] })
  })
})
