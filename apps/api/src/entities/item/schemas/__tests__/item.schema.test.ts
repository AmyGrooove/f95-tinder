import { describe, expect, it } from "@jest/globals"
import { createConnection } from "mongoose"

import { EItemType } from "../EItemType"
import { ItemSchema } from "../item.schema"
import type { TCreateItem } from "../item.schema"

describe("ItemSchema", () => {
  it.each([
    {
      name: "заданную дату",
      series: { lastReleasedEpisodeAt: new Date("2026-10-24T12:30:00+03:00") },
      expected: new Date("2026-10-24T09:30:00.000Z"),
    },
    {
      name: "явный null",
      series: { lastReleasedEpisodeAt: null },
      expected: null,
    },
    {
      name: "default null при отсутствии входного значения",
      series: {},
      expected: null,
    },
  ])(
    "формирует документ с $name для даты последнего эпизода",
    async ({ series, expected }) => {
      const connection = createConnection()

      try {
        const model = connection.model("Item", ItemSchema)
        const input = {
          type: EItemType.SERIES,
          title: { ru: "Сезон", en: null },
          releaseDate: new Date("2026-01-01T00:00:00.000Z"),
          series,
        } satisfies TCreateItem
        const item = new model(input)

        await item.validate()

        expect(item.toObject().series?.lastReleasedEpisodeAt).toEqual(expected)
        expect(item.releaseDate).toEqual(new Date("2026-01-01T00:00:00.000Z"))
      } finally {
        await connection.close()
      }
    },
  )
})
