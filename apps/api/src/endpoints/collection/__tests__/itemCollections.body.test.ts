import { describe, expect, it } from "@jest/globals"
import { plainToInstance } from "class-transformer"
import { validate } from "class-validator"

import { ItemCollectionsBodyDto } from "../dto/body/itemCollections.body"

describe("ItemCollectionsBodyDto", () => {
  it.each([undefined, "asc", "desc"])(
    "принимает сортировку relevanceScore с направлением %s",
    async (direction) => {
      const dto = plainToInstance(ItemCollectionsBodyDto, {
        sort: "relevanceScore",
        direction,
      })

      expect(
        await validate(dto, { whitelist: true, forbidNonWhitelisted: true }),
      ).toEqual([])
      expect(dto.sort).toBe("relevanceScore")
    },
  )

  it.each([
    { sort: "score", property: "sort" },
    { sort: "relevanceScore", direction: "down", property: "direction" },
  ])(
    "отклоняет недопустимую сортировку $sort/$direction",
    async ({ property, ...query }) => {
      const dto = plainToInstance(ItemCollectionsBodyDto, query)

      expect(await validate(dto)).toEqual([
        expect.objectContaining({ property }),
      ])
    },
  )

  it.each([1, 20, 60])(
    "принимает размер страницы %i в допустимом диапазоне",
    async (limit) => {
      const dto = plainToInstance(ItemCollectionsBodyDto, { limit })
      expect(await validate(dto)).toEqual([])
      expect(dto.limit).toBe(limit)
    },
  )

  it.each([0, 60.5, 61, 100])(
    "отклоняет недопустимый размер страницы %i",
    async (limit) => {
      const dto = plainToInstance(ItemCollectionsBodyDto, { limit })
      expect(await validate(dto)).toEqual([
        expect.objectContaining({ property: "limit" }),
      ])
    },
  )

  it.each([
    {},
    { ratingMin: "1" },
    { ratingMax: "10" },
    { ratingMin: "7.25", ratingMax: "8.5" },
  ])("принимает публичные числовые границы общей оценки %j", async (query) => {
    const dto = plainToInstance(ItemCollectionsBodyDto, query)
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
      const dto = plainToInstance(ItemCollectionsBodyDto, { [field]: "false" })
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
        const dto = plainToInstance(ItemCollectionsBodyDto, { [field]: value })
        expect(await validate(dto)).toEqual([
          expect.objectContaining({ property: field }),
        ])
      }
    },
  )
})
