import { describe, expect, it, jest } from "@jest/globals"

import { BACKGROUNDS } from "../../../static/BACKGROUNDS"

import { getRandomBackground } from ".."

describe("getRandomBackground", () => {
  it.each(BACKGROUNDS)("исключает предыдущий фон %s из выбора", (previous) => {
    const candidates = BACKGROUNDS.filter(
      (background) => background !== previous,
    )
    for (const [index, expected] of candidates.entries()) {
      jest.spyOn(Math, "random").mockReturnValue(index / candidates.length)
      expect(getRandomBackground(previous)).toBe(expected)
    }
  })

  it.each([undefined, "unknown"])(
    "выбирает из полного списка при неизвестном предыдущем фоне %s",
    (previous) => {
      for (const [index, expected] of BACKGROUNDS.entries()) {
        jest.spyOn(Math, "random").mockReturnValue(index / BACKGROUNDS.length)
        expect(getRandomBackground(previous)).toBe(expected)
      }
    },
  )
})
