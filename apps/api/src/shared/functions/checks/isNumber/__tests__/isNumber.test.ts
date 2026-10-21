import { describe, expect, it } from "@jest/globals"

import { isNumber } from ".."

describe("isNumber", () => {
  it.each(
    [0, -1, 0.5, Number.NaN, Infinity, -Infinity].map((value) => ({ value })),
  )("возвращает true для подходящего значения $value", ({ value }) => {
    expect(isNumber(value)).toBe(true)
  })

  it.each([undefined, null, "1", 1n, true, {}, []].map((value) => ({ value })))(
    "возвращает false для неподходящего значения $value",
    ({ value }) => {
      expect(isNumber(value)).toBe(false)
    },
  )
})
