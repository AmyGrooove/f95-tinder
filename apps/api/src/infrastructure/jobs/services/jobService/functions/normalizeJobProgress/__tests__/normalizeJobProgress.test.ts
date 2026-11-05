import { describe, expect, it } from "@jest/globals"

import { normalizeJobProgress } from "../core/normalizeJobProgress"

describe("normalizeJobProgress", () => {
  it.each([0, 50, 100])(
    "сохраняет целочисленный прогресс %s и текст статуса",
    (progress) => {
      expect(
        normalizeJobProgress({ progress, status: "working" }),
      ).toStrictEqual({ progress, status: "working" })
    },
  )

  it.each([-1, 101, 0.5, Number.NaN, Infinity, "50", null, undefined])(
    "сбрасывает некорректный прогресс %s в ноль",
    (progress) => {
      expect(
        normalizeJobProgress({ progress, status: "working" }),
      ).toStrictEqual({ progress: 0, status: "working" })
    },
  )

  it.each([undefined, null, true, 50, "working"])(
    "возвращает нулевой прогресс для %s",
    (value) => {
      expect(normalizeJobProgress(value)).toStrictEqual({ progress: 0 })
    },
  )

  it.each([undefined, null, 1, {}, []])(
    "исключает статус другого типа %s",
    (status) => {
      expect(normalizeJobProgress({ progress: 50, status })).toStrictEqual({
        progress: 50,
        status: undefined,
      })
    },
  )

  it("сохраняет пустой строковый статус и обрабатывает пустой объект", () => {
    expect(normalizeJobProgress({ status: "" })).toStrictEqual({
      progress: 0,
      status: "",
    })
    expect(normalizeJobProgress({})).toStrictEqual({
      progress: 0,
      status: undefined,
    })
  })
})
