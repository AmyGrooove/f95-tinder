import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals"

import { createInfrastructureConfiguration } from "../core/createInfrastructureConfiguration"
import { DICTIONARY } from "@shared/static/DICTIONARY"

describe("createInfrastructureConfiguration", () => {
  beforeEach(() => {
    jest.replaceProperty(process, "env", {
      APP_NAME: "test-api",
      APP_VERSION: "1.0.0",
      APP_DESCRIPTION: "Test API",
      PORT: "3000",
      CORS_ORIGINS: "https://app.example.test",
      MONGO_URL: "mongodb://localhost/test",
      REDIS_URL: "redis://localhost/0",
      JWT_ACCESS_SECRET: "a".repeat(32),
      JWT_REFRESH_SECRET: "r".repeat(32),
      GARAGE_URL: "https://storage.example.test",
      GARAGE_REGION: "test-region",
      GARAGE_ACCESS_KEY_ID: "test-access",
      GARAGE_SECRET_ACCESS_KEY: "test-secret",
      GARAGE_PUBLIC_URL: "https://cdn.example.test",
      MEILISEARCH_URL: "http://localhost:7700",
      MEILISEARCH_ACCESS_SECRET: "test-search",
      RESEND_ACCESS_SECRET: "test-mail",
      MAIL_DOMAIN: "mail.example.test",
      KODIK_API_TOKEN: "test-kodik",
    })
  })
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("собирает все разделы из изолированного окружения", () => {
    expect(createInfrastructureConfiguration()).toStrictEqual({
      app: {
        environment: "development",
        name: "test-api",
        version: "1.0.0",
        description: "Test API",
        port: 3000,
        corsOrigins: ["https://app.example.test"],
      },
      database: { uri: "mongodb://localhost/test" },
      redis: {
        url: "redis://localhost/0",
        host: "localhost",
        port: undefined,
        database: 0,
        isTls: false,
        username: undefined,
        password: undefined,
      },
      jwt: { accessSecret: "a".repeat(32), refreshSecret: "r".repeat(32) },
      storage: {
        endpoint: "https://storage.example.test/",
        region: "test-region",
        accessKey: "test-access",
        secretKey: "test-secret",
        publicUrl: "https://cdn.example.test/",
      },
      search: { host: "http://localhost:7700/", apiKey: "test-search" },
      mail: { apiKey: "test-mail", domain: "mail.example.test" },
      sources: { kodikApiToken: "test-kodik" },
    })
  })

  it.each(["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"])(
    "требует минимум 32 символа в %s",
    (key) => {
      process.env[key] = "a".repeat(31)

      expect(() => createInfrastructureConfiguration()).toThrow(
        DICTIONARY.config.JWT_SECRET_LENGTH,
      )
    },
  )

  it.each([
    "localhost",
    "-mail.example.test",
    "mail_.example.test",
    "https://mail.example.test",
  ])("отклоняет некорректный почтовый домен %s", (domain) => {
    process.env.MAIL_DOMAIN = domain

    expect(() => createInfrastructureConfiguration()).toThrow(
      DICTIONARY.config.INVALID_MAIL_DOMAIN,
    )
  })

  it.each([
    "MONGO_URL",
    "REDIS_URL",
    "JWT_ACCESS_SECRET",
    "JWT_REFRESH_SECRET",
    "APP_NAME",
    "APP_VERSION",
    "APP_DESCRIPTION",
    "PORT",
    "CORS_ORIGINS",
    "GARAGE_URL",
    "GARAGE_REGION",
    "GARAGE_ACCESS_KEY_ID",
    "GARAGE_SECRET_ACCESS_KEY",
    "GARAGE_PUBLIC_URL",
    "MEILISEARCH_URL",
    "MEILISEARCH_ACCESS_SECRET",
    "RESEND_ACCESS_SECRET",
    "MAIL_DOMAIN",
    "KODIK_API_TOKEN",
  ])("отклоняет конфигурацию без обязательной переменной %s", (key) => {
    delete process.env[key]

    expect(() => createInfrastructureConfiguration()).toThrow(key)
  })

  it.each([
    "MONGO_URL",
    "REDIS_URL",
    "GARAGE_URL",
    "GARAGE_PUBLIC_URL",
    "MEILISEARCH_URL",
  ])("проверяет допустимость протокола %s", (key) => {
    process.env[key] = "ftp://example.test"

    expect(() => createInfrastructureConfiguration()).toThrow(
      `${DICTIONARY.config.INVALID_URL_PROTOCOL}: ${key}`,
    )
  })

  it("принимает MongoDB SRV", () => {
    process.env.MONGO_URL = "mongodb+srv://mongo.example.test/test"

    expect(createInfrastructureConfiguration().database.uri).toBe(
      "mongodb+srv://mongo.example.test/test",
    )
  })
})
