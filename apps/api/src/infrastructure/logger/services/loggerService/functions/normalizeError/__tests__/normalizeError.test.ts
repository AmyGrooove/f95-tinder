import { describe, expect, it } from "@jest/globals"

import { normalizeError } from "../core/normalizeError"
import { DICTIONARY } from "@shared/static/DICTIONARY"

describe("normalizeError", () => {
  it("сохраняет сообщение, имя и стек экземпляра Error", () => {
    const error = new TypeError("failure")

    expect(normalizeError(error)).toStrictEqual({
      message: "failure",
      name: "TypeError",
      stack: error.stack,
      details: null,
    })
  })

  it.each(["failure", ""])("использует строку %s как сообщение", (message) => {
    expect(normalizeError(message)).toStrictEqual({ message, details: null })
  })

  it("помещает массив в поле errors", () => {
    const errors = ["first", { code: 2 }]

    expect(normalizeError(errors)).toStrictEqual({
      message: DICTIONARY.logger.unknownError,
      details: { errors },
    })
  })

  it("копирует собственные перечисляемые поля объекта в детали", () => {
    const error = { message: "custom", code: 42 }
    Object.defineProperty(error, "hidden", { value: "hidden" })
    const result = normalizeError(error)

    expect(result).toStrictEqual({
      message: DICTIONARY.logger.unknownError,
      details: { message: "custom", code: 42 },
    })
    expect(result.details).not.toBe(error)
  })

  it.each([undefined, null, 0, false, 1n, Symbol("error")])(
    "возвращает неизвестную ошибку для %s",
    (value) => {
      expect(normalizeError(value)).toStrictEqual({
        message: DICTIONARY.logger.unknownError,
        details: null,
      })
    },
  )
})
