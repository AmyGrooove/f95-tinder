import { describe, expect, it } from "@jest/globals"
import { createConnection } from "mongoose"

import { EItemType } from "../EItemType"
import { ItemSchema } from "../item.schema"
import type { TCreateItem } from "../item.schema"

describe("ItemSchema", () => {
  const series = {
    episodeCount: 12,
    releasedEpisodeCount: 1,
    episodeDuration: 24,
    nextEpisodeAt: new Date("2026-10-31T09:30:00.000Z"),
  }

  it.each([
    {
      name: "заданную дату",
      lastReleasedEpisodeAt: new Date("2026-10-24T12:30:00+03:00"),
      expected: new Date("2026-10-24T09:30:00.000Z"),
    },
    {
      name: "явный null",
      lastReleasedEpisodeAt: null,
      expected: null,
    },
  ])(
    "сохраняет $name в поле даты последнего эпизода",
    async ({ lastReleasedEpisodeAt, expected }) => {
      const connection = createConnection()

      try {
        const model = connection.model("Item", ItemSchema)
        const input = {
          type: EItemType.SERIES,
          title: { ru: "Сезон", en: null },
          releaseDate: new Date("2026-01-01T00:00:00.000Z"),
          series: { ...series, lastReleasedEpisodeAt },
        } satisfies TCreateItem
        const item = new model(input)

        await item.validate()

        const serialized = item.toObject()

        expect(serialized.series?.lastReleasedEpisodeAt).toEqual(expected)
        expect(item.releaseDate).toEqual(new Date("2026-01-01T00:00:00.000Z"))
      } finally {
        await connection.close()
      }
    },
  )

  it("отклоняет сериал без поля даты последнего эпизода", async () => {
    const connection = createConnection()

    try {
      const model = connection.model("Item", ItemSchema)
      const item = new model({
        type: EItemType.SERIES,
        title: { ru: "Сезон", en: null },
        series,
      })

      await expect(item.validate()).rejects.toMatchObject({
        errors: {
          "series.lastReleasedEpisodeAt": { kind: "required" },
        },
      })
    } finally {
      await connection.close()
    }
  })
})
