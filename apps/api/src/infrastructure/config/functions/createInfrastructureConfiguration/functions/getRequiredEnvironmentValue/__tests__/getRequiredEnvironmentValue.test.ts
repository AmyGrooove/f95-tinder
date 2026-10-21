import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals"

import { getRequiredEnvironmentValue } from "../core/getRequiredEnvironmentValue"
import { DICTIONARY } from "@shared/static/DICTIONARY"

describe("getRequiredEnvironmentValue", () => {
  beforeEach(() => {
    jest.replaceProperty(process, "env", {})
  })
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("удаляет окружающие пробелы и сохраняет внутренние", () => {
    process.env.APP_DESCRIPTION = "  test description \n"

    expect(getRequiredEnvironmentValue("APP_DESCRIPTION")).toBe(
      "test description",
    )
  })

  it.each([undefined, "", " \n\t "])(
    "отклоняет отсутствующее или пустое значение %s",
    (value) => {
      if (value !== undefined) {
        process.env.APP_NAME = value
      }

      expect(() => getRequiredEnvironmentValue("APP_NAME")).toThrow(
        `${DICTIONARY.config.MISSING_REQUIRED_ENVIRONMENT_VALUE}: APP_NAME`,
      )
    },
  )
})
