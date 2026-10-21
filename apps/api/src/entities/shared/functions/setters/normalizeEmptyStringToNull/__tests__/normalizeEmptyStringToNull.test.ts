import { describe, expect, it } from "@jest/globals"

import { normalizeEmptyStringToNull } from "../core/normalizeEmptyStringToNull"

describe("normalizeEmptyStringToNull", () => {
  it.each(["", " ", "\t\n\r", "\u00a0\u2003"])(
    "преобразует пустую или пробельную строку в null: %p",
    (value) => {
      expect(normalizeEmptyStringToNull(value)).toBeNull()
    },
  )

  it.each(
    ["text", " text ", "Текст", null, undefined, 0, false, {}, []].map(
      (value) => ({ value }),
    ),
  )("возвращает остальные значения без изменения: $value", ({ value }) => {
    expect(normalizeEmptyStringToNull(value)).toBe(value)
  })
})
