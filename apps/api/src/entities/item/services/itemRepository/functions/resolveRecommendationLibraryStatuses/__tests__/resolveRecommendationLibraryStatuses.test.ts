import { describe, expect, it } from "@jest/globals"

import { EUserItemStatus } from "@entities/userItem/schemas/EUserItemStatus"

import { resolveRecommendationLibraryStatuses } from "../core/resolveRecommendationLibraryStatuses"

describe("resolveRecommendationLibraryStatuses", () => {
  it("без фильтра оставляет только тайтлы вне библиотеки", () => {
    expect(resolveRecommendationLibraryStatuses()).toEqual(["outside"])
  })

  it("с пустым фильтром допускает все библиотечные статусы и тайтлы вне библиотеки", () => {
    expect(resolveRecommendationLibraryStatuses({})).toEqual([
      EUserItemStatus.PLANNED,
      EUserItemStatus.IN_PROGRESS,
      EUserItemStatus.ON_HOLD,
      EUserItemStatus.COMPLETED,
      EUserItemStatus.DROPPED,
      "outside",
    ])
  })

  it("применяет включение и исключение к одному статусу", () => {
    expect(
      resolveRecommendationLibraryStatuses({
        anyOf: ["outside", EUserItemStatus.PLANNED],
        noneOf: ["outside"],
      }),
    ).toEqual([EUserItemStatus.PLANNED])
    expect(
      resolveRecommendationLibraryStatuses({
        allOf: ["outside", EUserItemStatus.PLANNED],
      }),
    ).toEqual([])
  })
})
