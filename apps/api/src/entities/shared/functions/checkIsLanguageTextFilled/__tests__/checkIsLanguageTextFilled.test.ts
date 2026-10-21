import { describe, expect, it } from "@jest/globals"

import { checkIsLanguageTextFilled } from "../core/checkIsLanguageTextFilled"

describe("checkIsLanguageTextFilled", () => {
  it("сохраняет исходные переводы и пробелы", () => {
    const value = { ru: " Текст ", en: null }

    expect(checkIsLanguageTextFilled(value)).toBe(true)
    expect(value).toEqual({ ru: " Текст ", en: null })
  })

  it.each([
    undefined,
    null,
    { ru: null, en: null },
    { ru: "", en: "" },
    { ru: "", en: null },
    { ru: null, en: "" },
    { ru: " \t\n\r", en: null },
    { ru: null, en: " \t\n\r" },
    { ru: " \t\n\r", en: "\u00a0\u2003" },
  ])("возвращает false, если переводы не заполнены: %p", (value) => {
    expect(checkIsLanguageTextFilled(value)).toBe(false)
  })

  it.each([
    { ru: "Текст", en: null },
    { ru: null, en: "Text" },
    { ru: "Текст", en: "" },
    { ru: "", en: "Text" },
    { ru: "Текст", en: " \t\n" },
    { ru: " \t\n", en: "Text" },
    { ru: " \tТекст\n ", en: null },
    { ru: null, en: " \tText\n " },
    { ru: "Текст", en: "Text" },
  ])("возвращает true, если хотя бы один перевод заполнен: %p", (value) => {
    expect(checkIsLanguageTextFilled(value)).toBe(true)
  })
})
