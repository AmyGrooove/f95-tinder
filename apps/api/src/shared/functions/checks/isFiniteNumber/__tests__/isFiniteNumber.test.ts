import { describe, expect, it } from "@jest/globals"

import { isFiniteNumber } from "../core/isFiniteNumber"

describe("isFiniteNumber", () => {
  it.each([0, -0, -1, 1.5, Number.MAX_VALUE].map((value) => ({ value })))(
    "возвращает true для подходящего значения $value",
    ({ value }) => {
      expect(isFiniteNumber(value)).toBe(true)
    },
  )

  it.each(
    [Number.NaN, Infinity, -Infinity, undefined, null, "1", 1n, {}, []].map(
      (value) => ({ value }),
    ),
  )("возвращает false для неподходящего значения $value", ({ value }) => {
    expect(isFiniteNumber(value)).toBe(false)
  })
})
