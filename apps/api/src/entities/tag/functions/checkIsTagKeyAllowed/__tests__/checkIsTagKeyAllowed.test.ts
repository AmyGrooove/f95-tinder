import { describe, expect, it } from "@jest/globals"

import { ETagGroup } from "../../../schemas/ETagGroup"
import { checkIsTagKeyAllowed } from "../core/checkIsTagKeyAllowed"

describe("checkIsTagKeyAllowed", () => {
  it.each([null, undefined, 42, {}, []])(
    "отклоняет нестроковый ключ: %j",
    (key) => {
      expect(checkIsTagKeyAllowed({ key: key as string, group: null })).toBe(
        false,
      )
    },
  )

  it.each([
    { key: "custom", group: null, isAllowed: true },
    { key: "custom", group: ETagGroup.GENRE, isAllowed: true },
    { key: "shortGame", group: ETagGroup.GAME_LENGTH, isAllowed: true },
    { key: "unknown", group: ETagGroup.GAME_LENGTH, isAllowed: false },
    {
      key: "releaseStatusReleased",
      group: ETagGroup.RELEASE_STATUS,
      isAllowed: true,
    },
    { key: "released", group: ETagGroup.RELEASE_STATUS, isAllowed: false },
    { key: "duration0To30", group: ETagGroup.DURATION, isAllowed: true },
    { key: "duration30", group: ETagGroup.DURATION, isAllowed: false },
    {
      key: "releaseYear1To1930",
      group: ETagGroup.RELEASE_YEAR,
      isAllowed: true,
    },
    ...["1", "9999", "2026"].map((suffix) => ({
      key: `releaseYear${suffix}`,
      group: ETagGroup.RELEASE_YEAR,
      isAllowed: true,
    })),
    ...[
      "0",
      "10000",
      "01",
      "1.5",
      "1e3",
      "+1",
      " 1",
      "",
      "Infinity",
      "9007199254740992",
    ].map((suffix) => ({
      key: `releaseYear${suffix}`,
      group: ETagGroup.RELEASE_YEAR,
      isAllowed: false,
    })),
    { key: "2026", group: ETagGroup.RELEASE_YEAR, isAllowed: false },
  ])("проверяет ключ $key в группе $group", ({ isAllowed, ...props }) => {
    expect(checkIsTagKeyAllowed(props)).toBe(isAllowed)
  })

  it("отклоняет неизвестную группу", () => {
    expect(
      checkIsTagKeyAllowed({ key: "custom", group: "unknown" as ETagGroup }),
    ).toBe(false)
  })
})
