import { describe, expect, it } from "@jest/globals"

import { isArray } from "../core/isArray"

describe("isArray", () => {
  it.each([[], [1, "a"], new Array(2)].map((value) => ({ value })))(
    "возвращает true для подходящего значения $value",
    ({ value }) => {
      expect(isArray(value)).toBe(true)
    },
  )

  it.each(
    [undefined, null, {}, { length: 0 }, "[]", 1, true].map((value) => ({
      value,
    })),
  )("возвращает false для неподходящего значения $value", ({ value }) => {
    expect(isArray(value)).toBe(false)
  })
})
