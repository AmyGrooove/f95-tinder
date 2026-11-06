import { describe, expect, it } from "@jest/globals"

import { getExplicitStructuredResponse } from "../core/getExplicitStructuredResponse"

describe("getExplicitStructuredResponse", () => {
  it.each([
    [{ field: "title" }, { field: "title" }],
    [["title"], { errors: ["title"] }],
    [42, null],
    [undefined, null],
  ])("нормализует детали явной ошибки %j", (details, expected) => {
    expect(
      getExplicitStructuredResponse({
        code: "BAD_REQUEST",
        message: "Ошибка",
        details,
      }),
    ).toEqual({
      code: "BAD_REQUEST",
      message: "Ошибка",
      details: expected,
    })
  })

  it("сохраняет явный HTTP-код", () => {
    expect(
      getExplicitStructuredResponse({ code: "HTTP_418", message: "Ошибка" }),
    ).toEqual({
      code: "HTTP_418",
      message: "Ошибка",
      details: null,
    })
  })

  it.each([
    {},
    { code: "INVALID", message: "Ошибка" },
    { code: "HTTP_418", message: 42 },
  ])("отклоняет ответ с некорректными полями %j", (response) => {
    expect(getExplicitStructuredResponse(response)).toBeUndefined()
  })
})
