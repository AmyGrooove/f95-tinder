import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals"

import { createRedisConfiguration } from "../core/createRedisConfiguration"
import { DICTIONARY } from "@shared/static/DICTIONARY"

describe("createRedisConfiguration", () => {
  beforeEach(() => {
    jest.replaceProperty(process, "env", {})
  })
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("использует базу 0 без явного порта и реквизитов", () => {
    process.env.REDIS_URL = "redis://localhost"

    expect(createRedisConfiguration()).toStrictEqual({
      url: "redis://localhost",
      host: "localhost",
      port: undefined,
      database: 0,
      isTls: false,
      username: undefined,
      password: undefined,
    })
  })

  it("разбирает TLS, порт, базу и кодированные реквизиты", () => {
    process.env.REDIS_URL =
      "rediss://test%40user:p%40ss%3Aword@redis.example.test:6380/12"

    expect(createRedisConfiguration()).toStrictEqual({
      url: process.env.REDIS_URL,
      host: "redis.example.test",
      port: 6380,
      database: 12,
      isTls: true,
      username: "test@user",
      password: "p@ss:word",
    })
  })

  it.each(["", "0", "01", String(Number.MAX_SAFE_INTEGER)])(
    "принимает допустимый номер базы %s",
    (database) => {
      process.env.REDIS_URL = `redis://localhost/${database}`

      expect(createRedisConfiguration().database).toBe(
        database === "" ? 0 : Number(database),
      )
    },
  )

  it.each(["-1", "1.5", "abc", "1/2", String(Number.MAX_SAFE_INTEGER + 1)])(
    "отклоняет некорректный номер базы %s",
    (database) => {
      process.env.REDIS_URL = `redis://localhost/${database}`

      expect(() => createRedisConfiguration()).toThrow(
        DICTIONARY.config.REDIS_DATABASE,
      )
    },
  )

  it("отклоняет URL другого протокола", () => {
    process.env.REDIS_URL = "https://localhost/0"

    expect(() => createRedisConfiguration()).toThrow(
      DICTIONARY.config.INVALID_URL_PROTOCOL,
    )
  })
})
