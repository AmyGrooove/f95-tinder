import { describe, expect, it } from "@jest/globals"

import { getHttpExceptionMessage } from "../core/getHttpExceptionMessage"

describe("getHttpExceptionMessage", () => {
  it.each(["сообщение", { message: "сообщение" }])(
    "возвращает сообщение из ответа %j",
    (response) => {
      expect(getHttpExceptionMessage(response, "запасное")).toBe("сообщение")
    },
  )

  it.each([null, {}, { message: ["ошибка"] }, { message: 42 }])(
    "возвращает запасное сообщение для ответа %j",
    (response) => {
      expect(getHttpExceptionMessage(response, "запасное")).toBe("запасное")
    },
  )
})
