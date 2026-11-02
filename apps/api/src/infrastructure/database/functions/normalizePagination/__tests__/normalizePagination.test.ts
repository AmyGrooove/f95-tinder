import { describe, expect, it } from "@jest/globals"

import type { TPageSize } from "@infrastructure/database/types/TPageSize"

import { normalizePagination } from "../core/normalizePagination"

describe("normalizePagination", () => {
  it.each([undefined, {}, { page: undefined, limit: undefined }])(
    "использует страницу 1 и лимит 50 для %p",
    (pagination) => {
      expect(normalizePagination(pagination)).toEqual({ page: 1, limit: 50 })
    },
  )

  it.each<TPageSize>([10, 20, 50])(
    "сохраняет допустимый размер страницы %p",
    (limit) => {
      expect(normalizePagination({ page: 3, limit })).toEqual({
        page: 3,
        limit,
      })
    },
  )

  it.each([
    { page: 3, expectedPage: 3 },
    { page: 2.9, expectedPage: 2 },
    { page: 1.9, expectedPage: 1 },
    { page: 0, expectedPage: 1 },
    { page: -2, expectedPage: 1 },
    { page: NaN, expectedPage: 1 },
    { page: Infinity, expectedPage: 1 },
    { page: -Infinity, expectedPage: 1 },
  ])(
    "нормализует страницу $page независимо от допустимого лимита",
    ({ page, expectedPage }) => {
      expect(normalizePagination({ page, limit: 20 })).toEqual({
        page: expectedPage,
        limit: 20,
      })
    },
  )

  it.each([
    0,
    -10,
    1,
    15.9,
    20.5,
    100,
    101,
    NaN,
    Infinity,
    -Infinity,
    "20",
    null,
  ])("заменяет неподдерживаемый runtime-лимит %p на 50", (limit) => {
    expect(
      Reflect.apply(normalizePagination, undefined, [{ page: 3, limit }]),
    ).toEqual({ page: 3, limit: 50 })
  })

  it.each(["3", null])(
    "заменяет нечисловую runtime-страницу %p на 1",
    (page) => {
      expect(
        Reflect.apply(normalizePagination, undefined, [{ page, limit: 10 }]),
      ).toEqual({ page: 1, limit: 10 })
    },
  )

  it("применяет значения по умолчанию независимо для страницы и лимита", () => {
    expect(normalizePagination({ page: 3 })).toEqual({ page: 3, limit: 50 })
    expect(normalizePagination({ limit: 10 })).toEqual({ page: 1, limit: 10 })
  })

  it("не изменяет исходные параметры", () => {
    const pagination = Object.freeze({ page: 2.5, limit: 20 })

    expect(normalizePagination(pagination)).toEqual({ page: 2, limit: 20 })
    expect(pagination).toEqual({ page: 2.5, limit: 20 })
  })
})
