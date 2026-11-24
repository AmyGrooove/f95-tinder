import { beforeEach, describe, expect, it, jest } from "@jest/globals"

import { createInfrastructureConfiguration } from "../core/createInfrastructureConfiguration"
import { CONFIG_ERROR_MESSAGES } from "../static/CONFIG_ERROR_MESSAGES"
import { TEST_ENVIRONMENT } from "./static/TEST_ENVIRONMENT"

describe("createInfrastructureConfiguration", () => {
  beforeEach(() => {
    jest.replaceProperty(process, "env", { ...TEST_ENVIRONMENT })
  })

  it("собирает конфигурацию приложения и всех подключений из окружения", () => {
    expect(createInfrastructureConfiguration()).toStrictEqual({
      app: {
        environment: "development",
        siteVariant: "main",
        name: "test-api",
        version: "1.2.3",
        description: "Test API",
        port: 3000,
        corsOrigins: ["https://app.example.test"],
      },
      knowledge: { username: "", password: "" },
      database: { uri: TEST_ENVIRONMENT.MONGO_URL },
      redis: {
        url: TEST_ENVIRONMENT.REDIS_URL,
        host: "redis.example.test",
        port: 6380,
        database: 2,
        isTls: true,
        username: undefined,
        password: undefined,
      },
      jwt: {
        accessSecret: TEST_ENVIRONMENT.JWT_ACCESS_SECRET,
        refreshSecret: TEST_ENVIRONMENT.JWT_REFRESH_SECRET,
      },
      storage: {
        endpoint: "http://storage.example.test/",
        region: TEST_ENVIRONMENT.GARAGE_REGION,
        accessKey: TEST_ENVIRONMENT.GARAGE_ACCESS_KEY_ID,
        secretKey: TEST_ENVIRONMENT.GARAGE_SECRET_ACCESS_KEY,
        publicUrl: TEST_ENVIRONMENT.GARAGE_PUBLIC_URL,
      },
      search: {
        host: "https://search.example.test/",
        apiKey: TEST_ENVIRONMENT.MEILISEARCH_ACCESS_SECRET,
      },
      mail: {
        apiKey: TEST_ENVIRONMENT.RESEND_ACCESS_SECRET,
        domain: TEST_ENVIRONMENT.MAIL_DOMAIN,
      },
    })
  })

  it("сохраняет заданные учётные данные базы знаний", () => {
    process.env.KNOWLEDGE_USERNAME = "reader"
    process.env.KNOWLEDGE_PASSWORD = "test-password"

    expect(createInfrastructureConfiguration().knowledge).toStrictEqual({
      username: "reader",
      password: "test-password",
    })
  })

  it("принимает Redis без TLS, HTTPS для Garage и HTTP для Meilisearch", () => {
    process.env.REDIS_URL = "redis://localhost/0"
    process.env.GARAGE_URL = "https://storage.example.test"
    process.env.GARAGE_PUBLIC_URL = "https://cdn.example.test"
    process.env.MEILISEARCH_URL = "http://localhost:7700"

    const configuration = createInfrastructureConfiguration()

    expect(configuration.redis).toStrictEqual({
      url: "redis://localhost/0",
      host: "localhost",
      port: undefined,
      database: 0,
      isTls: false,
      username: undefined,
      password: undefined,
    })
    expect(configuration.storage.endpoint).toBe("https://storage.example.test/")
    expect(configuration.storage.publicUrl).toBe("https://cdn.example.test/")
    expect(configuration.search.host).toBe("http://localhost:7700/")
  })

  it("принимает адрес MongoDB с протоколом mongodb+srv", () => {
    const uri = "mongodb+srv://db.example.test/catalog"
    process.env.MONGO_URL = uri

    expect(createInfrastructureConfiguration().database.uri).toBe(uri)
  })

  it.each([
    "MONGO_URL",
    "REDIS_URL",
    "GARAGE_URL",
    "GARAGE_PUBLIC_URL",
    "MEILISEARCH_URL",
  ])("отклоняет неподдерживаемый протокол в %s", (key) => {
    process.env[key] = "ftp://service.example.test"

    expect(createInfrastructureConfiguration).toThrow(
      `${CONFIG_ERROR_MESSAGES.INVALID_URL_PROTOCOL}: ${key}`,
    )
  })

  it.each(["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"])(
    "отклоняет 31 символ в %s",
    (key) => {
      process.env[key] = "x".repeat(31)

      expect(createInfrastructureConfiguration).toThrow(
        CONFIG_ERROR_MESSAGES.JWT_SECRET_LENGTH,
      )
    },
  )

  it.each([
    "localhost",
    "-mail.example.test",
    "mail_.example.test",
    "https://mail.example.test",
    "sender@example.test",
  ])("отклоняет некорректный почтовый домен %s", (domain) => {
    process.env.MAIL_DOMAIN = domain

    expect(createInfrastructureConfiguration).toThrow(
      CONFIG_ERROR_MESSAGES.INVALID_MAIL_DOMAIN,
    )
  })

  it.each(Object.keys(TEST_ENVIRONMENT))(
    "отклоняет конфигурацию без обязательной переменной %s",
    (key) => {
      delete process.env[key]

      expect(createInfrastructureConfiguration).toThrow(key)
    },
  )

  it.each([
    "JWT_ACCESS_SECRET",
    "JWT_REFRESH_SECRET",
    "MAIL_DOMAIN",
    "GARAGE_REGION",
    "GARAGE_ACCESS_KEY_ID",
    "GARAGE_SECRET_ACCESS_KEY",
    "MEILISEARCH_ACCESS_SECRET",
    "RESEND_ACCESS_SECRET",
  ])("отклоняет пустую обязательную переменную %s", (key) => {
    process.env[key] = " "

    expect(createInfrastructureConfiguration).toThrow(
      `${CONFIG_ERROR_MESSAGES.MISSING_REQUIRED_ENVIRONMENT_VALUE}: ${key}`,
    )
  })
})
