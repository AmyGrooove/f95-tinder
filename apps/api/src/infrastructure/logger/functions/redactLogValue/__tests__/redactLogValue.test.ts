import { describe, expect, it } from "@jest/globals"

import { redactLogValue } from "../core/redactLogValue"

describe("redactLogValue", () => {
  it.each([
    "password",
    "refreshToken",
    "Authorization",
    "cookie",
    "client_secret",
    "API-KEY",
    "nested_password_hash",
  ])("скрывает чувствительное поле %s", (key) => {
    expect(
      redactLogValue({ [key]: "sensitive", visible: "public" }),
    ).toStrictEqual({ [key]: "[REDACTED]", visible: "public" })
  })

  it("обрабатывает вложенные объекты и массивы без изменения исходных данных", () => {
    const value = {
      users: [{ password: "sensitive", name: "user" }],
      count: 1n,
      createdAt: new Date(0),
    }

    expect(redactLogValue(value)).toStrictEqual({
      users: [{ password: "[REDACTED]", name: "user" }],
      count: "1",
      createdAt: "1970-01-01T00:00:00.000Z",
    })
    expect(value.users[0]?.password).toBe("sensitive")
    expect(value.count).toBe(1n)
    expect(value.createdAt).toBeInstanceOf(Date)
  })

  it("заменяет циклическую ссылку объекта маркером", () => {
    const value: Record<string, unknown> = { name: "root" }
    value.self = value

    expect(redactLogValue(value)).toStrictEqual({
      name: "root",
      self: "[Circular]",
    })
  })

  it("заменяет циклическую ссылку массива маркером", () => {
    const value: unknown[] = []
    value.push(value)

    expect(redactLogValue(value)).toStrictEqual(["[Circular]"])
  })

  it.each([undefined, null, 0, false, "public"])(
    "сохраняет примитивное значение %s",
    (value) => {
      expect(redactLogValue(value)).toBe(value)
    },
  )
})
