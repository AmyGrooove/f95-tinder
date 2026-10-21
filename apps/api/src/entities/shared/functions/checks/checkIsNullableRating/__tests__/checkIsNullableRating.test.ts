import { describe, expect, it } from "@jest/globals"

import { checkIsNullableRating } from "../core/checkIsNullableRating"

describe("checkIsNullableRating", () => {
  it.each([null, undefined, 1, 5, 10])(
    "принимает отсутствие оценки или целую оценку от 1 до 10: %p",
    (value) => {
      expect(checkIsNullableRating(value)).toBe(true)
    },
  )

  it.each(
    [
      0,
      -1,
      11,
      1.5,
      Number.NaN,
      Infinity,
      -Infinity,
      "5",
      "",
      true,
      5n,
      {},
      [],
    ].map((value) => ({ value })),
  )(
    "отклоняет дробную оценку, выход за границы и другой тип: $value",
    ({ value }) => {
      expect(checkIsNullableRating(value)).toBe(false)
    },
  )
})
