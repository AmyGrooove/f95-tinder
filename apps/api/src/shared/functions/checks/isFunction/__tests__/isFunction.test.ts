import { describe, expect, it } from "@jest/globals"

import { isFunction } from "../core/isFunction"

describe("isFunction", () => {
  it.each(
    [() => undefined, async () => undefined, Math.max, class Example {}].map(
      (value) => ({ value }),
    ),
  )("возвращает true для подходящего значения $value", ({ value }) => {
    expect(isFunction(value)).toBe(true)
  })

  it.each(
    [undefined, null, {}, [], "function", 0, true].map((value) => ({ value })),
  )("возвращает false для неподходящего значения $value", ({ value }) => {
    expect(isFunction(value)).toBe(false)
  })
})
