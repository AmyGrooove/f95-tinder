import { describe, expect, it } from "@jest/globals"

import { checkIsArrayWithoutNil } from "../core/checkIsArrayWithoutNil"

describe("checkIsArrayWithoutNil", () => {
  it.each(
    [[], [0, false, ""], [1, "text", {}, []]].map((value) => ({ value })),
  )("принимает массив без null и undefined: $value", ({ value }) => {
    expect(checkIsArrayWithoutNil(value)).toBe(true)
  })

  it.each(
    [
      null,
      undefined,
      {},
      "text",
      0,
      false,
      [null],
      [undefined],
      [1, null],
      [undefined, 1],
    ].map((value) => ({ value })),
  )(
    "отклоняет не массив или массив с null либо undefined: $value",
    ({ value }) => {
      expect(checkIsArrayWithoutNil(value)).toBe(false)
    },
  )
})
