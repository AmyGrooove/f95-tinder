import { describe, expect, it } from "@jest/globals"

import { defineJob } from "../core/defineJob"
import { DICTIONARY } from "@shared/static/DICTIONARY"

describe("defineJob", () => {
  it("создаёт определение с версией 1 и без повторных попыток по умолчанию", () => {
    expect(defineJob("sync")).toStrictEqual({
      name: "sync",
      version: 1,
      retryDelays: [],
    })
  })

  it("сохраняет параметры и копирует задержки", () => {
    const retryDelays = [0, 1000]
    const result = defineJob("sync", { version: 2, retryDelays })
    retryDelays.push(2000)

    expect(result).toStrictEqual({
      name: "sync",
      version: 2,
      retryDelays: [0, 1000],
    })
  })

  it.each(["", "  ", "\n"])("отклоняет пустое имя %s", (name) => {
    expect(() => defineJob(name)).toThrow(DICTIONARY.jobs.invalidDefinition)
  })

  it.each([0, -1, 1.5, Number.NaN, Infinity])(
    "отклоняет недопустимую версию %s",
    (version) => {
      expect(() => defineJob("sync", { version })).toThrow(
        DICTIONARY.jobs.invalidDefinition,
      )
    },
  )

  it.each([-1, 0.5, Number.NaN, Infinity])(
    "отклоняет недопустимую задержку %s",
    (delay) => {
      expect(() => defineJob("sync", { retryDelays: [0, delay] })).toThrow(
        DICTIONARY.jobs.invalidRetryDelays,
      )
    },
  )
})
