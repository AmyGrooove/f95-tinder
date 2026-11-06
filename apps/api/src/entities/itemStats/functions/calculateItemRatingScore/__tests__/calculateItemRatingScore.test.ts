import { describe, expect, it } from "@jest/globals"

import { calculateItemRatingScore } from ".."

describe("calculateItemRatingScore", () => {
  it.each([
    { ratingAverage: null, ratingsCount: 20 },
    { ratingAverage: 8, ratingsCount: 0 },
  ])("возвращает null при отсутствии оценок (%j)", (ratings) => {
    expect(
      calculateItemRatingScore({ ...ratings, siteRatingAverage: 6 }),
    ).toBeNull()
  })

  it.each([
    { ratingsCount: 5, siteRatingAverage: 6, expected: 6.4 },
    { ratingsCount: 20, siteRatingAverage: 6, expected: 7 },
    { ratingsCount: 20, siteRatingAverage: null, expected: 6.75 },
  ])(
    "сглаживает среднюю оценку с учётом числа голосов (%j)",
    ({ ratingsCount, siteRatingAverage, expected }) => {
      expect(
        calculateItemRatingScore({
          ratingAverage: 8,
          ratingsCount,
          siteRatingAverage,
        }),
      ).toBeCloseTo(expected, 8)
    },
  )
})
