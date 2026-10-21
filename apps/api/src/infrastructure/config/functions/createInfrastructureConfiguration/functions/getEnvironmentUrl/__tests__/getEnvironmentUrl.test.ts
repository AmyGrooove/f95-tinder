import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals"

import { getEnvironmentUrl } from "../core/getEnvironmentUrl"
import { DICTIONARY } from "@shared/static/DICTIONARY"

describe("getEnvironmentUrl", () => {
  beforeEach(() => {
    jest.replaceProperty(process, "env", {})
  })
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("возвращает URL после удаления окружающих пробелов", () => {
    process.env.GARAGE_URL = "  https://storage.example.test/path  "

    const url = getEnvironmentUrl("GARAGE_URL", ["http:", "https:"])

    expect(url).toBeInstanceOf(URL)
    expect(url.toString()).toBe("https://storage.example.test/path")
  })

  it.each([undefined, "", "not-a-url", "/relative"])(
    "отклоняет некорректный URL %s с указанием переменной",
    (value) => {
      if (value !== undefined) {
        process.env.GARAGE_URL = value
      }

      expect(() => getEnvironmentUrl("GARAGE_URL", ["https:"])).toThrow(
        `${DICTIONARY.config.INVALID_ENVIRONMENT_URL}: GARAGE_URL`,
      )
    },
  )

  it("отклоняет URL с запрещённым протоколом", () => {
    process.env.GARAGE_URL = "ftp://storage.example.test"

    expect(() => getEnvironmentUrl("GARAGE_URL", ["http:", "https:"])).toThrow(
      `${DICTIONARY.config.INVALID_URL_PROTOCOL}: GARAGE_URL`,
    )
  })
})
