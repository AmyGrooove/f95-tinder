import { describe, expect, it } from "@jest/globals"

import { isUndefined } from "../core/isUndefined"

describe("isUndefined", () => {
  it("возвращает true для undefined", () => {
    expect(isUndefined(undefined)).toBe(true)
  })

  it.each(
    [
      null,
      false,
      true,
      0,
      1,
      Number.NaN,
      "",
      "undefined",
      0n,
      Symbol("undefined"),
      {},
      [],
      () => undefined,
    ].map((value) => ({ value })),
  )("возвращает false для значения другого типа $value", ({ value }) => {
    expect(isUndefined(value)).toBe(false)
  })
})
