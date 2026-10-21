import { describe, expect, it } from "@jest/globals"

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
    "вычисляет метаданные для страницы $page при $total элементах",
    ({ total, page, pages, isNextPage, isPreviousPage }) => {
      const items = [{ id: "item" }]

      expect(createPaginatedResult(items, total, page, 10)).toEqual({
        items,
        total,
        page,
        limit: 10,
        pages,
        isNextPage,
        isPreviousPage,
      })
    },
  )

  it("сохраняет элементы и поддерживает пустой результат", () => {
    const items = [{ id: 1 }, { id: 2 }]

    expect(createPaginatedResult(items, 2, 1, 10).items).toEqual(items)
    expect(createPaginatedResult([], 0, 1, 10).items).toEqual([])
    expect(items).toEqual([{ id: 1 }, { id: 2 }])
  })
})
