import { describe, expect, it } from "@jest/globals"

import { isString } from "../core/isString"

describe("isString", () => {
  it.each(["", "text", "строка"].map((value) => ({ value })))(
    "возвращает true для подходящего значения $value",
    ({ value }) => {
      expect(isString(value)).toBe(true)
    },
  )

  it.each(
    [undefined, null, 0, true, {}, [], Symbol("text")].map((value) => ({
      value,
    })),
  )("возвращает false для неподходящего значения $value", ({ value }) => {
    expect(isString(value)).toBe(false)
  })
})
