import { describe, expect, it, jest } from "@jest/globals"
import { BadRequestException, type ExecutionContext } from "@nestjs/common"
import { of } from "rxjs"

import { DICTIONARY } from "@entities/shared/static/DICTIONARY"

import { CollectionQueryBodyInterceptor } from "../core/collectionQueryBody.interceptor"

describe("CollectionQueryBodyInterceptor", () => {
  const interceptor = new CollectionQueryBodyInterceptor()
  const context = (body: unknown) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ body }) }),
    }) as ExecutionContext

  it.each([[undefined], [null], [false], [0], ["{}"], [[]]])(
    "отклоняет тело %p и не вызывает обработчик",
    (body) => {
      const handle = jest.fn(() => of())
      expect(() => interceptor.intercept(context(body), { handle })).toThrow(
        new BadRequestException(DICTIONARY.collection.queryBodyRequired),
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
