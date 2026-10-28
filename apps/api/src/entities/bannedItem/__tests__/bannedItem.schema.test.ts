import { describe, expect, it } from "@jest/globals"
import { model, Types } from "mongoose"

import { ECountry } from "@entities/shared/schemas/ECountry"

import { BannedItemSchema } from "../schemas/bannedItem.schema"

describe("BannedItemSchema", () => {
  const BannedItemModel = model("BannedItemCountryValidation", BannedItemSchema)

  it("сохраняет глобальный запрет по умолчанию", async () => {
    const document = new BannedItemModel({
      source: new Types.ObjectId(),
      externalId: "global",
    })

    await expect(document.validate()).resolves.toBeUndefined()
    expect(document.countries).toEqual([])
  })

  it("сохраняет несколько стран и отдельную группу unknown", async () => {
    const countries = [ECountry.RUSSIA, ECountry.KAZAKHSTAN, ECountry.UNKNOWN]
    const document = new BannedItemModel({
      source: new Types.ObjectId(),
      externalId: "regional",
      countries,
    })

    await expect(document.validate()).resolves.toBeUndefined()
    expect(document.countries).toEqual(countries)
  })

  it.each([
    { countries: ["unsupported"] },
    { countries: [ECountry.RUSSIA, "unsupported"] },
    { countries: null },
  ])(
    "отклоняет недопустимый список стран: $countries",
    async ({ countries }) => {
      const document = new BannedItemModel({
        source: new Types.ObjectId(),
        externalId: "invalid",
        countries,
      })

      await expect(document.validate()).rejects.toMatchObject({
        name: "ValidationError",
      })
    },
  )
})
