import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals"

import { createAppConfiguration } from "../core/createAppConfiguration"
import { DICTIONARY } from "@shared/static/DICTIONARY"

describe("createAppConfiguration", () => {
  beforeEach(() => {
    jest.replaceProperty(process, "env", {
      APP_NAME: "test-api",
      APP_VERSION: "1.2.3",
      APP_DESCRIPTION: "Test API",
      PORT: "3000",
      CORS_ORIGINS: "https://app.example.test",
    })
  })
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("создаёт конфигурацию development по умолчанию и нормализует источники CORS", () => {
    process.env.CORS_ORIGINS =
      " https://APP.example.test:443/, , http://localhost:3001/ "

    expect(createAppConfiguration()).toStrictEqual({
      environment: "development",
      name: "test-api",
      version: "1.2.3",
      description: "Test API",
      port: 3000,
      corsOrigins: ["https://app.example.test", "http://localhost:3001"],
    })
  })

  it("принимает production с явными источниками CORS", () => {
    process.env.NODE_ENV = " production "

    expect(createAppConfiguration().environment).toBe("production")
  })

  it("разрешает wildcard в development", () => {
    process.env.CORS_ORIGINS = "*"

    expect(createAppConfiguration().corsOrigins).toEqual(["*"])
  })

  it("запрещает wildcard среди источников production", () => {
    process.env.NODE_ENV = "production"
    process.env.CORS_ORIGINS = "https://app.example.test,*"

    expect(() => createAppConfiguration()).toThrow(
      DICTIONARY.config.PRODUCTION_CORS_ORIGINS,
    )
  })

  it.each(["1", "65535"])("принимает граничный порт %s", (port) => {
    process.env.PORT = port

    expect(createAppConfiguration().port).toBe(Number(port))
  })

  it.each(["0", "65536", "-1", "1.5", "NaN", "Infinity"])(
    "отклоняет некорректный порт %s",
    (port) => {
      process.env.PORT = port

      expect(() => createAppConfiguration()).toThrow(
        DICTIONARY.config.INVALID_PORT,
      )
    },
  )

  it.each(["test", "staging", ""])(
    "отклоняет недопустимое окружение %s",
    (environment) => {
      process.env.NODE_ENV = environment

      expect(() => createAppConfiguration()).toThrow(
        DICTIONARY.config.INVALID_NODE_ENV,
      )
    },
  )

  it.each(["ab", "A-api", "-api", "api-", "a".repeat(64)])(
    "отклоняет некорректное имя %s",
    (name) => {
      process.env.APP_NAME = name

      expect(() => createAppConfiguration()).toThrow(
        DICTIONARY.config.INVALID_APP_NAME,
      )
    },
  )

  it.each(["1.0", "v1.2.3", "1.2.3-"])(
    "отклоняет некорректную версию %s",
    (version) => {
      process.env.APP_VERSION = version

      expect(() => createAppConfiguration()).toThrow(
        DICTIONARY.config.INVALID_APP_VERSION,
      )
    },
  )

  it("принимает версию с prerelease и build-метаданными", () => {
    process.env.APP_VERSION = "1.2.3-beta.1+build.42"

    expect(createAppConfiguration().version).toBe("1.2.3-beta.1+build.42")
  })

  it.each([
    "not-a-url",
    "ftp://app.example.test",
    "https://app.example.test/path",
    "https://app.example.test/?query=1",
    "https://app.example.test/#hash",
    "https://user:pass@app.example.test",
  ])("отклоняет некорректный источник CORS %s", (origin) => {
    process.env.CORS_ORIGINS = origin

    expect(() => createAppConfiguration()).toThrow(
      DICTIONARY.config.INVALID_CORS_ORIGINS,
    )
  })

  it("отклоняет список CORS без источников", () => {
    process.env.CORS_ORIGINS = " , , "

    expect(() => createAppConfiguration()).toThrow(
      DICTIONARY.config.EMPTY_CORS_ORIGINS,
    )
  })

  it("требует непустое описание приложения", () => {
    process.env.APP_DESCRIPTION = "  "

    expect(() => createAppConfiguration()).toThrow(
      DICTIONARY.config.MISSING_REQUIRED_ENVIRONMENT_VALUE,
    )
  })
})
