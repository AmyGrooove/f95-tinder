import { describe, expect, it } from "@jest/globals"

import { isInt } from "../core/isInt"

describe("isInt", () => {
  it.each(
    [0, -0, -1, 1, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1].map(
      (value) => ({ value }),
    ),
  )("возвращает true для подходящего значения $value", ({ value }) => {
    expect(isInt(value)).toBe(true)
  })

  it.each(
    [
      0.5,
      -0.5,
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
    expect(isInt(value)).toBe(false)
  })
})
