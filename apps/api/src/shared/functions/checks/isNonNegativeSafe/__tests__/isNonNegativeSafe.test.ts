import { describe, expect, it } from "@jest/globals"

import { isNonNegativeSafe } from ".."

describe("isNonNegativeSafe", () => {
  it.each([0, -0, 0.5, 1, Number.MAX_SAFE_INTEGER].map((value) => ({ value })))(
    "возвращает true для подходящего значения $value",
    ({ value }) => {
      expect(isNonNegativeSafe(value)).toBe(true)
    },
  )

  it.each(
    [
      -1,
      -0.5,
      Number.MAX_SAFE_INTEGER + 1,
      Number.NaN,
      Infinity,
      -Infinity,
      undefined,
      null,
      "1",
      1n,
      {},
      [],
    ].map((value) => ({ value })),
  )("возвращает false для неподходящего значения $value", ({ value }) => {
    expect(isNonNegativeSafe(value)).toBe(false)
  })
})
