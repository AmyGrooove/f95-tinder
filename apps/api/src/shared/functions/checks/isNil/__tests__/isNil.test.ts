import { describe, expect, it } from "@jest/globals"

import { isNil } from "../core/isNil"

describe("isNil", () => {
  it.each([undefined, null].map((value) => ({ value })))(
    "возвращает true для подходящего значения $value",
    ({ value }) => {
      expect(isNil(value)).toBe(true)
    },
  )

  it.each([false, 0, Number.NaN, "", {}, []].map((value) => ({ value })))(
    "возвращает false для неподходящего значения $value",
    ({ value }) => {
      expect(isNil(value)).toBe(false)
    },
  )
})
