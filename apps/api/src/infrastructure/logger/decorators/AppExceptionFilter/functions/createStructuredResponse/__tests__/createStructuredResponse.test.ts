import { describe, expect, it } from "@jest/globals"
import { HttpException } from "@nestjs/common"

import { DICTIONARY } from "@shared/static/DICTIONARY"
import { createStructuredResponse } from "../core/createStructuredResponse"

describe("createStructuredResponse", () => {
  it("скрывает сообщение внутреннего исключения", () => {
    expect(createStructuredResponse(new Error("секрет"), 500)).toEqual({
      code: "INTERNAL_ERROR",
      message: DICTIONARY.errors.INTERNAL_ERROR,
      details: null,
    })
  })

  it("сохраняет строковое сообщение HTTP-исключения и выводит код из статуса", () => {
    expect(
      createStructuredResponse(new HttpException("Недоступно", 503), 503),
    ).toEqual({
      code: "HTTP_503",
      message: "Недоступно",
      details: null,
    })
  })
})
