import { describe, expect, it, jest } from "@jest/globals"
import { BadRequestException, type ExecutionContext } from "@nestjs/common"
import { of } from "rxjs"

import { DICTIONARY } from "@entities/shared/static/DICTIONARY"

import { SearchBodyInterceptor } from "../core/searchBody.interceptor"

describe("SearchBodyInterceptor", () => {
  const interceptor = new SearchBodyInterceptor()
  const context = (body: unknown) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ body }) }),
    }) as ExecutionContext

  it.each([[undefined], [null], [false], [0], ["{}"], [[]]])(
    "отклоняет тело %p и не вызывает обработчик",
    (body) => {
      const handle = jest.fn(() => of())
      expect(() => interceptor.intercept(context(body), { handle })).toThrow(
        new BadRequestException(DICTIONARY.search.bodyRequired),
      )
      expect(handle).not.toHaveBeenCalled()
    },
  )

  it("передаёт объект обработчику и возвращает его результат", () => {
    const result = of("result")
    const handle = jest.fn(() => result)
    expect(interceptor.intercept(context({}), { handle })).toBe(result)
    expect(handle).toHaveBeenCalledTimes(1)
  })
})
