import { describe, expect, it } from "@jest/globals"

import { isBoolean } from ".."

describe("isBoolean", () => {
  it.each([true, false].map((isValue) => ({ isValue })))(
    "возвращает true для логического значения $isValue",
    ({ isValue }) => {
      expect(isBoolean(isValue)).toBe(true)
    },
  )

  it.each(
    [
      undefined,
      null,
      0,
      1,
      Number.NaN,
      "",
      "true",
      "false",
      0n,
      1n,
      Symbol("boolean"),
      {},
      [],
      Object(true),
      Object(false),
      () => true,
    ].map((value) => ({ value })),
  )("возвращает false для значения другого типа $value", ({ value }) => {
    expect(isBoolean(value)).toBe(false)
  })
})
