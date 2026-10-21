import { setImmediate } from "node:timers/promises"

import { describe, expect, it } from "@jest/globals"

import { requestContext } from "../core/requestContext"

describe("requestContext", () => {
  it("возвращает undefined вне контекста и игнорирует запись", () => {
    requestContext.set("requestId", "outside")

    expect(requestContext.get("requestId")).toBeUndefined()
    expect(requestContext.getAll()).toBeUndefined()
  })

  it("предоставляет контекст и возвращает результат обработчика", () => {
    const context = { requestId: "request", method: "GET", path: "/test" }

    const result = requestContext.run(context, () => {
      expect(requestContext.get("requestId")).toBe("request")
      expect(requestContext.get("missing")).toBeUndefined()
      expect(requestContext.getAll()).toEqual(context)

      return 42
    })

    expect(result).toBe(42)
    expect(requestContext.getAll()).toBeUndefined()
  })

  it("добавляет и перезаписывает значения активного контекста", () => {
    requestContext.run(
      { requestId: "request", method: "GET", path: "/" },
      () => {
        requestContext.set("userId", 123)
        expect(requestContext.get("userId")).toBe(123)

        requestContext.set("userId", null)
        expect(requestContext.get("userId")).toBeNull()

        requestContext.set("userId", undefined)
        expect(requestContext.get("userId")).toBeUndefined()
      },
    )
  })

  it("возвращает поверхностную копию контекста", () => {
    requestContext.run(
      { requestId: "request", method: "GET", path: "/" },
      () => {
        const snapshot = requestContext.getAll()

        expect(snapshot).toBeDefined()

        if (snapshot === undefined) {
          throw new Error("Контекст отсутствует")
        }

        snapshot.requestId = "changed"
        expect(requestContext.get("requestId")).toBe("request")

        requestContext.set("path", "/changed")
        expect(snapshot.path).toBe("/")
      },
    )
  })

  it("восстанавливает внешний контекст после вложенного вызова", () => {
    requestContext.run({ requestId: "outer", method: "GET", path: "/" }, () => {
      requestContext.run(
        { requestId: "inner", method: "POST", path: "/" },
        () => {
          requestContext.set("requestId", "changed-inner")
          expect(requestContext.get("requestId")).toBe("changed-inner")
        },
      )

      expect(requestContext.get("requestId")).toBe("outer")
    })
  })

  it("передаёт ошибку обработчика и очищает контекст", () => {
    const error = new Error("failure")

    expect(() =>
      requestContext.run(
        { requestId: "request", method: "GET", path: "/" },
        () => {
          throw error
        },
      ),
    ).toThrow(error)
    expect(requestContext.getAll()).toBeUndefined()
  })

  it("сохраняет изоляцию параллельных асинхронных запросов", async () => {
    const results = await Promise.all(
      ["first", "second"].map((requestId) => {
        return requestContext.run(
          { requestId, method: "GET", path: "/" },
          async () => {
            await setImmediate()
            expect(requestContext.get("requestId")).toBe(requestId)
            requestContext.set("result", requestId)
            await setImmediate()

            return requestContext.get("result")
          },
        )
      }),
    )

    expect(results).toEqual(["first", "second"])
    expect(requestContext.getAll()).toBeUndefined()
  })

  it("передаёт асинхронную ошибку и не оставляет активный контекст", async () => {
    const error = new Error("async failure")

    await expect(
      requestContext.run(
        { requestId: "request", method: "GET", path: "/" },
        async () => {
          await setImmediate()
          throw error
        },
      ),
    ).rejects.toBe(error)
    expect(requestContext.getAll()).toBeUndefined()
  })
})
