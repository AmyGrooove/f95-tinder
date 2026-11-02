import { describe, expect, it } from "@jest/globals"

import type { TPageSize } from "@infrastructure/database/types/TPageSize"

import { createPaginatedResult } from "../core/createPaginatedResult"

describe("createPaginatedResult", () => {
  it.each([
    { total: 0, page: 1, pages: 0, isNextPage: false, isPreviousPage: false },
    { total: 5, page: 1, pages: 1, isNextPage: false, isPreviousPage: false },
    { total: 20, page: 1, pages: 2, isNextPage: true, isPreviousPage: false },
    { total: 21, page: 2, pages: 3, isNextPage: true, isPreviousPage: true },
    { total: 21, page: 3, pages: 3, isNextPage: false, isPreviousPage: true },
    { total: 21, page: 4, pages: 3, isNextPage: false, isPreviousPage: true },
  ])(
    "возвращает метаданные без limit для страницы $page при $total элементах",
    ({ total, page, pages, isNextPage, isPreviousPage }) => {
      const items = total === 0 || page > pages ? [] : [{ id: "item" }]

      expect(createPaginatedResult(items, total, page, 10)).toEqual({
        items,
        total,
        page,
        pages,
        isNextPage,
        isPreviousPage,
      })
    },
  )

  it.each<{ limit: TPageSize; pages: number }>([
    { limit: 10, pages: 6 },
    { limit: 20, pages: 3 },
    { limit: 50, pages: 2 },
  ])(
    "рассчитывает число страниц по total при лимите $limit",
    ({ limit, pages }) => {
      expect(createPaginatedResult([{ id: 1 }], 51, 1, limit)).toEqual({
        items: [{ id: 1 }],
        total: 51,
        page: 1,
        pages,
        isNextPage: true,
        isPreviousPage: false,
      })
    },
  )

  it("сохраняет порядок и данные элементов без изменения исходного массива", () => {
    const items = [{ id: 2 }, { id: 1 }]

    expect(createPaginatedResult(items, 2, 1, 10).items).toEqual([
      { id: 2 },
      { id: 1 },
    ])
    expect(items).toEqual([{ id: 2 }, { id: 1 }])
  })
})
