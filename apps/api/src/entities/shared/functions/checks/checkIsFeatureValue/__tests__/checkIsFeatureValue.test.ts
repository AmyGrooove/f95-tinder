import { describe, expect, it } from "@jest/globals"

import { checkIsFeatureValue } from "../core/checkIsFeatureValue"

describe("checkIsFeatureValue", () => {
  it.each(
    [0, -1, 1.5, Number.MAX_VALUE, "", "text", true, false, new Date(0)].map(
      (value) => ({ value }),
    ),
  )(
    "принимает конечное число, строку, boolean или корректную дату: $value",
    ({ value }) => {
      expect(checkIsFeatureValue(value)).toBe(true)
    },
  )

  it.each(
    [
      null,
      undefined,
      Number.NaN,
      Infinity,
      -Infinity,
      new Date(Number.NaN),
      {},
      [],
      1n,
    ].map((value) => ({ value })),
  )("отклоняет неподдерживаемое значение: $value", ({ value }) => {
    expect(checkIsFeatureValue(value)).toBe(false)
  })
})
