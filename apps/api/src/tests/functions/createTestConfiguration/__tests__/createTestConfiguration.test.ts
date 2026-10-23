import { describe, expect, it } from "@jest/globals"

import { createTestConfiguration } from "../core/createTestConfiguration"

describe("createTestConfiguration", () => {
  it.each(["redis://localhost", "redis://localhost/"])(
    "использует базу по умолчанию и необязательный порт для %s",
    (url) => {
      const configuration = createTestConfiguration(
        "mongodb://localhost/test",
        url,
      )

      expect(configuration.database).toStrictEqual({
        uri: "mongodb://localhost/test",
      })
      expect(configuration.redis).toStrictEqual({
        url,
        host: "localhost",
        port: undefined,
        database: 0,
        isTls: false,
        password: undefined,
        username: undefined,
      })
    },
  )

  it("сохраняет порт, базу, TLS и декодирует учётные данные Redis", () => {
    const url = "rediss://test%40user:pass%3Aword@localhost:6380/12"
    const configuration = createTestConfiguration(
      "mongodb://localhost/test",
      url,
    )

    expect(configuration.redis).toStrictEqual({
      url,
      host: "localhost",
      port: 6380,
      database: 12,
      isTls: true,
      username: "test@user",
      password: "pass:word",
    })
  })

  it("создаёт отдельные секреты JWT для каждого окружения", () => {
    const first = createTestConfiguration(
      "mongodb://localhost/test",
      "redis://localhost",
    )
    const second = createTestConfiguration(
      "mongodb://localhost/test",
      "redis://localhost",
    )

    expect(
      new Set([
        first.jwt.accessSecret,
        first.jwt.refreshSecret,
        second.jwt.accessSecret,
        second.jwt.refreshSecret,
      ]).size,
    ).toBe(4)
  })
})
