import { describe, expect, it } from "@jest/globals"
import { plainToInstance } from "class-transformer"
import { validate } from "class-validator"
import { ItemCollectionsBodyDto } from "@endpoints/collection/services/collectionContentService"

describe("ItemCollectionsBodyDto", () => {
  const validateBody = (body: object) =>
    validate(plainToInstance(ItemCollectionsBodyDto, body), {
      whitelist: true,
      forbidNonWhitelisted: true,
    })

  it.each([{}, { cursor: "YWI", limit: 10 }, { limit: 20 }, { limit: 50 }])(
    "принимает параметры подгрузки %j",
    async (body) => expect(await validateBody(body)).toEqual([]),
  )

  it.each([0, 60, 10.5, "10", null])(
    "отклоняет размер порции %j",
    async (limit) => {
      expect(await validateBody({ limit })).toEqual([
        expect.objectContaining({ property: "limit" }),
      ])
    },
  )

  it.each([null, false, "", "a/b", "x".repeat(151)])(
    "отклоняет курсор %j",
    async (cursor) => {
      expect(await validateBody({ cursor })).toEqual([
        expect.objectContaining({ property: "cursor" }),
      ])
    },
  )

  it.each([
    "page",
    "mode",
    "sort",
    "direction",
    "language",
    "groupId",
    "query",
    "tags",
    "excludeTags",
    "fields",
    "ratingMin",
    "ratingMax",
    "statuses",
    "isInLibrary",
    "isFavorite",
  ])("отклоняет удалённое поле %s", async (field) => {
    expect(await validateBody({ [field]: 1 })).toEqual([
      expect.objectContaining({ property: field }),
    ])
  })
})
