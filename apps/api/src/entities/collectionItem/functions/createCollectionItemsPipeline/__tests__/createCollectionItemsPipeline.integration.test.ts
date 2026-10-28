import { describe, expect, it } from "@jest/globals"
import { Types } from "mongoose"

import { EItemField } from "@entities/item/schemas/EItemField"
import { EItemFieldValueType } from "@entities/item/schemas/EItemFieldValueType"
import { ELanguage } from "@entities/shared/schemas/ELanguage"
import { getTestDatabase } from "@test/setup/setupDatabase"

import type { IReadCollectionItemsProps } from "../../../types/IReadCollectionItemsProps"
import { createCollectionItemsPipeline } from "../core/createCollectionItemsPipeline"

describe("createCollectionItemsPipeline", () => {
  it.each(["collection", "title", "relevanceScore"] as const)(
    "сортирует по %s до пагинации и сохраняет полное количество",
    async (sort) => {
      const { connection } = getTestDatabase()
      const collectionId = new Types.ObjectId()
      const groupId = new Types.ObjectId()
      const ids = Array.from({ length: 3 }, () => new Types.ObjectId())
      await connection.collection("Item").insertMany([
        { _id: ids[0], title: { ru: "Б", en: "B" }, media: [] },
        { _id: ids[1], title: { ru: " ", en: "A" }, media: [] },
        { _id: ids[2], title: { ru: "В", en: "C" }, media: [] },
      ])
      await connection.collection("CollectionItem").insertMany(
        ids.map((item, index) => ({
          collectionId,
          groupId,
          item,
          position: index,
          relevanceScore: index === 0 ? null : index / 2,
          note: "Заметка",
        })),
      )
      const props: IReadCollectionItemsProps = {
        collectionId,
        groupIds: [groupId],
        isGrouped: false,
        sort,
        direction: -1,
        language: ELanguage.RUSSIAN,
        page: 1,
        limit: 2,
        tags: [],
        excludeTags: [],
        fields: [],
      }
      const [result] = await connection
        .collection("CollectionItem")
        .aggregate(createCollectionItemsPipeline(props))
        .toArray()
      const expected =
        sort === "collection" ? [ids[0], ids[1]] : [ids[2], ids[1]]
      if (sort === "title") {
        expected[1] = ids[0]
      }
      expect(
        result.items.map(
          ({ item }: { item: { _id: Types.ObjectId } }) => item._id,
        ),
      ).toEqual(expected)
      expect(result.count).toEqual([{ total: 3 }])
      expect(result.items[0]).toEqual(
        expect.objectContaining({ note: "Заметка", groupId }),
      )
      expect(result.items[0].item).not.toHaveProperty("aliases")
      const [page] = await connection
        .collection("CollectionItem")
        .aggregate(createCollectionItemsPipeline({ ...props, page: 3 }))
        .toArray()
      expect(page).toEqual({ items: [], count: [{ total: 3 }] })
    },
  )

  it("применяет группу, буквальный поиск, теги, числовые и датовые границы и рейтинг совместно", async () => {
    const { connection } = getTestDatabase()
    const collectionId = new Types.ObjectId()
    const groupId = new Types.ObjectId()
    const tag = new Types.ObjectId()
    const excluded = new Types.ObjectId()
    const ids = Array.from({ length: 8 }, () => new Types.ObjectId())
    await connection.collection("Item").insertMany(
      ids.map((_id, index) => ({
        _id,
        title: { ru: index === 1 ? "axb" : "a.b", en: "Title" },
        aliases: [],
        movie: { duration: index === 2 ? "90" : 90 },
        releaseDate: new Date("2020-01-01"),
        ageRestriction: "18++",
        deletedAt: index === 3 ? new Date() : null,
      })),
    )
    await connection.collection("CollectionItem").insertMany(
      ids.map((item, index) => ({
        collectionId,
        groupId: index === 4 ? new Types.ObjectId() : groupId,
        item,
        position: index,
      })),
    )
    await connection
      .collection("ItemTag")
      .insertMany(
        ids.flatMap((item, index) =>
          index === 5
            ? []
            : [
                { item, tag },
                ...(index === 6 ? [{ item, tag: excluded }] : []),
              ],
        ),
      )
    await connection.collection("ItemMetric").insertMany(
      ids.map((item, index) => ({
        item,
        ratingAverage: index === 7 ? null : 8,
      })),
    )
    const props: IReadCollectionItemsProps = {
      collectionId,
      groupIds: [groupId],
      groupId,
      isGrouped: true,
      sort: "collection",
      direction: 1,
      language: ELanguage.RUSSIAN,
      page: 1,
      limit: 20,
      query: "a.b",
      tags: [tag],
      excludeTags: [excluded],
      fields: [
        {
          field: EItemField.DURATION,
          valueType: EItemFieldValueType.NUMBER,
          min: 90,
          max: 90,
        },
        {
          field: EItemField.AGE_RESTRICTION,
          valueType: EItemFieldValueType.NUMBER,
          min: 18,
          max: 18,
        },
        {
          field: EItemField.RELEASE_DATE,
          valueType: EItemFieldValueType.DATE,
          min: new Date("2020-01-01"),
          max: new Date("2020-01-01"),
        },
      ],
      ratingMin: 8,
      ratingMax: 8,
    }
    const [result] = await connection
      .collection("CollectionItem")
      .aggregate(createCollectionItemsPipeline(props))
      .toArray()
    expect(result.count).toEqual([{ total: 1 }])
    expect(result.items[0].item._id).toEqual(ids[0])
  })

  it("ищет по английскому названию и псевдонимам, исключая удалённые и отсутствующие произведения", async () => {
    const { connection } = getTestDatabase()
    const collectionId = new Types.ObjectId()
    const groupId = new Types.ObjectId()
    const ids = Array.from({ length: 4 }, () => new Types.ObjectId())
    await connection.collection("Item").insertMany([
      { _id: ids[0], title: { en: "MATCH" } },
      { _id: ids[1], title: { ru: "Другое" }, aliases: ["Match"] },
      { _id: ids[2], title: { en: "Match" }, deletedAt: new Date() },
    ])
    await connection.collection("CollectionItem").insertMany(
      ids.map((item, position) => ({
        collectionId,
        groupId,
        item,
        position,
      })),
    )
    const [result] = await connection
      .collection("CollectionItem")
      .aggregate(
        createCollectionItemsPipeline({
          collectionId,
          groupIds: [groupId],
          isGrouped: false,
          sort: "collection",
          direction: 1,
          language: ELanguage.ENGLISH,
          page: 1,
          limit: 20,
          query: "match",
          tags: [],
          excludeTags: [],
          fields: [],
        }),
      )
      .toArray()
    expect(
      result.items.map(
        ({ item }: { item: { _id: Types.ObjectId } }) => item._id,
      ),
    ).toEqual(ids.slice(0, 2))
  })
})
