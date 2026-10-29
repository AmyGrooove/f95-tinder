import { describe, expect, it } from "@jest/globals"
import { Types } from "mongoose"

import { getTestDatabase } from "@test/setup/setupDatabase"

import { EItemField } from "../../../schemas/EItemField"
import { EItemType } from "../../../schemas/EItemType"
import { createItemFilterPipeline } from "../core/createItemFilterPipeline"

describe("createItemFilterPipeline", () => {
  it("совмещает тип, кандидатов и исключения, удаляя помеченные произведения", async () => {
    const collection = getTestDatabase().connection.collection("Item")
    const ids = Array.from({ length: 5 }, () => new Types.ObjectId())
    await collection.insertMany(
      ids.map((_id, index) => ({
        _id,
        type: index === 2 ? EItemType.MOVIE : EItemType.GAME,
        deletedAt: index === 3 ? new Date() : null,
      })),
    )
    const result = await collection
      .aggregate(
        createItemFilterPipeline({
          candidateItemIds: ids.slice(0, 4),
          excludeItemIds: [ids[1]],
          filter: { types: [EItemType.GAME] },
        }),
      )
      .toArray()
    expect(result.map(({ _id }) => _id)).toEqual([ids[0]])
    expect(
      await collection
        .aggregate(createItemFilterPipeline({ candidateItemIds: [] }))
        .toArray(),
    ).toEqual([])
    expect(
      await collection.aggregate(createItemFilterPipeline({})).toArray(),
    ).toHaveLength(4)
  })

  it("проверяет включительные границы, типы значений и нормализует возраст 18++", async () => {
    const collection = getTestDatabase().connection.collection("Item")
    await collection.insertMany([
      {
        name: "valid",
        movie: { duration: 90 },
        releaseDate: new Date("2020-01-01"),
        ageRestriction: "18++",
      },
      {
        name: "short",
        movie: { duration: 89 },
        releaseDate: new Date("2020-01-01"),
        ageRestriction: "18",
      },
      {
        name: "string",
        movie: { duration: "90" },
        releaseDate: new Date("2020-01-01"),
        ageRestriction: "18",
      },
      {
        name: "date-string",
        movie: { duration: 90 },
        releaseDate: "2020-01-01",
        ageRestriction: "18",
      },
      {
        name: "unknown",
        movie: { duration: 90 },
        releaseDate: new Date("2020-01-01"),
        ageRestriction: null,
      },
    ])
    const result = await collection
      .aggregate(
        createItemFilterPipeline({
          filter: {
            fields: [
              { field: EItemField.DURATION, min: 90, max: 90 },
              {
                field: EItemField.RELEASE_DATE,
                min: new Date("2020-01-01"),
                max: new Date("2020-01-01"),
              },
              { field: EItemField.AGE_RESTRICTION, min: 18, max: 18 },
            ],
          },
        }),
      )
      .toArray()
    expect(result.map(({ name }) => name)).toEqual(["valid"])
  })

  it("требует все существующие теги и не принимает осиротевшие назначения", async () => {
    const { connection } = getTestDatabase()
    const tags = [new Types.ObjectId(), new Types.ObjectId()]
    const ids = [new Types.ObjectId(), new Types.ObjectId()]
    await connection.collection("Item").insertMany(ids.map((_id) => ({ _id })))
    await connection.collection("Tag").insertMany(tags.map((_id) => ({ _id })))
    await connection.collection("TagItem").insertMany([
      { item: ids[0], tag: tags[0] },
      { item: ids[0], tag: tags[1] },
      { item: ids[1], tag: tags[0] },
    ])
    const pipeline = createItemFilterPipeline({ filter: { tagIds: tags } })
    const result = await connection
      .collection("Item")
      .aggregate(pipeline)
      .toArray()
    expect(result.map(({ _id }) => _id)).toEqual([ids[0]])
    expect(result[0]).not.toHaveProperty("searchFilterTags")
    await connection.collection("Tag").deleteOne({ _id: tags[1] })
    expect(
      await connection.collection("Item").aggregate(pipeline).toArray(),
    ).toEqual([])
    expect(
      await connection
        .collection("Item")
        .aggregate(createItemFilterPipeline({ filter: { tagIds: [] } }))
        .toArray(),
    ).toHaveLength(2)
  })
})
