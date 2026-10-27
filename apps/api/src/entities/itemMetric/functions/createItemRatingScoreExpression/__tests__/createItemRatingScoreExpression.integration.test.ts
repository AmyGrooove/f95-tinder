import { describe, expect, it } from "@jest/globals"

import { getTestDatabase } from "@test/setup/setupDatabase"

import { createItemRatingScoreExpression } from "../index"

describe("createItemRatingScoreExpression MongoDB", () => {
  it.each([
    { ratingAverage: 9, ratingsCount: 20, siteRatingAverage: 7, expected: 8 },
    {
      ratingAverage: 10,
      ratingsCount: 1,
      siteRatingAverage: 7,
      expected: 150 / 21,
    },
    {
      ratingAverage: 8,
      ratingsCount: 100,
      siteRatingAverage: 7,
      expected: 940 / 120,
    },
    { ratingAverage: null, ratingsCount: 0, siteRatingAverage: 7, expected: 7 },
    { ratingAverage: 10, ratingsCount: 0, siteRatingAverage: 7, expected: 7 },
    { ratingAverage: null, ratingsCount: 1, siteRatingAverage: 7, expected: 7 },
    {
      ratingAverage: 9,
      ratingsCount: 20,
      siteRatingAverage: null,
      expected: 7.25,
    },
    { siteRatingAverage: null, expected: 5.5 },
    { siteRatingAverage: 7, expected: 7 },
  ])(
    "вычисляет сглаженный рейтинг и поддерживает отсутствие агрегатов: %j",
    async ({ siteRatingAverage, expected, ...metric }) => {
      const collection = getTestDatabase().connection.collection("ItemMetric")
      await collection.insertOne(metric)
      const results = await collection
        .aggregate<{ score: number }>([
          {
            $project: {
              _id: 0,
              score: createItemRatingScoreExpression({
                ratingAverage: "$ratingAverage",
                ratingsCount: "$ratingsCount",
                siteRatingAverage,
              }),
            },
          },
        ])
        .toArray()
      expect(results).toHaveLength(1)
      expect(results[0].score).toBeCloseTo(expected, 12)
    },
  )
})
