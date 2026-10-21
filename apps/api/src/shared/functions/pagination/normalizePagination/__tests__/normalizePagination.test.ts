import { describe, expect, it } from "@jest/globals"

import { normalizePagination } from "../core/normalizePagination"

describe("normalizePagination", () => {
  it.each([undefined, {}, { page: undefined, limit: undefined }])(
    "использует первую страницу и заданный лимит по умолчанию для %p",
    (pagination) => {
      expect(normalizePagination(pagination, 25)).toEqual({
        page: 1,
        limit: 25,
      })
    },
  )

  it.each([NaN, Infinity, -Infinity])(
    "заменяет неконечные значения %p значениями по умолчанию",
    (value) => {
      expect(normalizePagination({ page: value, limit: value }, 20)).toEqual({
        page: 1,
        limit: 20,
      })
    },
  )

  it.each([
    { page: 3, limit: 10, expectedPage: 3, expectedLimit: 10 },
    { page: 2.9, limit: 15.9, expectedPage: 2, expectedLimit: 15 },
    { page: 0, limit: 0, expectedPage: 1, expectedLimit: 1 },
    { page: -2, limit: -10, expectedPage: 1, expectedLimit: 1 },
    { page: 1, limit: 100, expectedPage: 1, expectedLimit: 100 },
    { page: 200, limit: 101, expectedPage: 200, expectedLimit: 100 },
  ])(
    "нормализует страницу $page и лимит $limit",
    ({ page, limit, expectedPage, expectedLimit }) => {
      expect(normalizePagination({ page, limit }, 20)).toEqual({
        page: expectedPage,
        limit: expectedLimit,
      })
    },
  )

  it("применяет значения по умолчанию независимо для страницы и лимита", () => {
    expect(normalizePagination({ page: 3 }, 40)).toEqual({ page: 3, limit: 40 })
    expect(normalizePagination({ limit: 5 }, 40)).toEqual({ page: 1, limit: 5 })
  })

  it("не изменяет исходные параметры", () => {
    const pagination = Object.freeze({ page: 2.5, limit: 101 })

    expect(normalizePagination(pagination, 20)).toEqual({ page: 2, limit: 100 })
    expect(pagination).toEqual({ page: 2.5, limit: 101 })
  })
})
