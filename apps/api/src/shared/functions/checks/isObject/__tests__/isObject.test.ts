import { describe, expect, it } from "@jest/globals"

import { isObject } from "../core/isObject"

describe("isObject", () => {
  it.each(
    [{}, [], new Date(0), new Map(), Object.create(null)].map((value) => ({
      value,
    })),
  )("возвращает true для подходящего значения $value", ({ value }) => {
    expect(isObject(value)).toBe(true)
  })

  it.each(
    [undefined, null, 0, "", true, Symbol("value"), 1n, () => undefined].map(
      (value) => ({ value }),
    ),
  )("возвращает false для неподходящего значения $value", ({ value }) => {
    expect(isObject(value)).toBe(false)
  })
})
