import { describe, expect, it } from "@jest/globals"

import { checkIsNonNegativeSafeInteger } from "../core/checkIsNonNegativeSafeInteger"

describe("checkIsNonNegativeSafeInteger", () => {
  it.each([0, -0, 1, Number.MAX_SAFE_INTEGER])(
    "принимает неотрицательное безопасное целое: %p",
    (value) => {
      expect(checkIsNonNegativeSafeInteger(value)).toBe(true)
    },
  )

  it.each(
    [
      -1,
      0.5,
      Number.MAX_SAFE_INTEGER + 1,
      Number.NaN,
      Infinity,
      -Infinity,
      null,
      undefined,
      "1",
      true,
      1n,
      {},
      [],
    ].map((value) => ({ value })),
  )(
    "отклоняет значение вне диапазона или другого типа: $value",
    ({ value }) => {
      expect(checkIsNonNegativeSafeInteger(value)).toBe(false)
    },
  )
})
