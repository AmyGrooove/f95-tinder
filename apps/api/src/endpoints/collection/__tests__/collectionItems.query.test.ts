import { describe, expect, it } from "@jest/globals"
import { plainToInstance } from "class-transformer"
import { validate } from "class-validator"

import { CollectionItemsQueryDto } from "../dto/query/collectionItems.query"

describe("CollectionItemsQueryDto", () => {
  it.each([
    {},
    { ratingMin: "1" },
    { ratingMax: "10" },
    { ratingMin: "7.25", ratingMax: "8.5" },
  ])("принимает публичные числовые границы общей оценки %j", async (query) => {
    const dto = plainToInstance(CollectionItemsQueryDto, query)
    expect(
      await validate(dto, { whitelist: true, forbidNonWhitelisted: true }),
    ).toEqual([])
    if ("ratingMin" in query) {
      expect(dto.ratingMin).toBe(Number(query.ratingMin))
    }
    if ("ratingMax" in query) {
      expect(dto.ratingMax).toBe(Number(query.ratingMax))
    }
  })

  it.each(["statuses", "isInLibrary", "isFavorite"])(
    "отклоняет удалённый личный фильтр %s",
    async (field) => {
      const dto = plainToInstance(CollectionItemsQueryDto, { [field]: "false" })
      const errors = await validate(dto, {
        whitelist: true,
        forbidNonWhitelisted: true,
      })
      expect(errors).toEqual([
        expect.objectContaining({
          property: field,
          constraints: { whitelistValidation: expect.any(String) },
        }),
      ])
    },
  )

  it.each(["ratingMin", "ratingMax"])(
    "отклоняет неверные значения %s",
    async (field) => {
      for (const value of [
        "",
        "0",
        "10.1",
        "NaN",
        "Infinity",
        "bad",
        ["7", "8"],
      ]) {
        const dto = plainToInstance(CollectionItemsQueryDto, { [field]: value })
        expect(await validate(dto)).toEqual([
          expect.objectContaining({ property: field }),
        ])
      }
    },
  )
})
