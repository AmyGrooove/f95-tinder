import { describe, expect, it } from "@jest/globals"

import { checkIsNonEmptyStringArray } from "../core/checkIsNonEmptyStringArray"

describe("checkIsNonEmptyStringArray", () => {
  it.each([[], ["text"], ["Текст", " text "]].map((value) => ({ value })))(
    "принимает массив строк с текстом, включая пустой массив: $value",
    ({ value }) => {
      expect(checkIsNonEmptyStringArray(value)).toBe(true)
    },
  )

  it.each(
    [
      null,
      undefined,
      {},
      "text",
      [""],
      [" \t\n"],
      ["\u00a0\u2003"],
      ["text", ""],
      [null],
      [undefined],
      [1],
      [false],
      [{}],
      [["text"]],
    ].map((value) => ({ value })),
  )(
    "отклоняет не массив или элементы без строкового текста: $value",
    ({ value }) => {
      expect(checkIsNonEmptyStringArray(value)).toBe(false)
    },
  )

  it("сохраняет пробелы в исходных строках", () => {
    const value = [" text "]

    expect(checkIsNonEmptyStringArray(value)).toBe(true)
    expect(value).toEqual([" text "])
  })
})
