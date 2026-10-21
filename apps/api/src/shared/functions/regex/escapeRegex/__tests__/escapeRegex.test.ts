import { describe, expect, it } from "@jest/globals"

import { escapeRegex } from ".."

describe("escapeRegex", () => {
  it.each(["", "abc 123", "Привет", "a-b/c_d"])(
    "сохраняет строку без специальных символов %p",
    (value) => {
      expect(escapeRegex(value)).toBe(value)
    },
  )

  it.each([
    ".",
    "*",
    "+",
    "?",
    "^",
    "$",
    "{",
    "}",
    "(",
    ")",
    "|",
    "[",
    "]",
    "\\",
  ])("экранирует специальный символ %p", (value) => {
    expect(escapeRegex(value)).toBe(`\\${value}`)
  })

  it("экранирует все вхождения и позволяет искать строку буквально", () => {
    const value = "a.b.*+?^${}()|[]\\a.b"
    const expression = new RegExp(`^${escapeRegex(value)}$`)

    expect(expression.test(value)).toBe(true)
    expect(expression.test(value.replace(".", "x"))).toBe(false)
    expect(expression.test(`${value}extra`)).toBe(false)
  })
})
