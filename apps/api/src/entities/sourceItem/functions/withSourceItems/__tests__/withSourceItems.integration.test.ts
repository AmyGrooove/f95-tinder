import { describe, expect, it } from "@jest/globals"
import { Types } from "mongoose"

import { getTestDatabase } from "@test/setup/setupDatabase"

import { withSourceItems } from "../core/withSourceItems"

describe("withSourceItems", () => {
  it("оставляет только произведения нужного источника и возвращает их внешние ID", async () => {
    const { connection } = getTestDatabase()
    const source = new Types.ObjectId()
    const item = new Types.ObjectId()
    const other = new Types.ObjectId()
    await connection
      .collection("Item")
      .insertMany([
        { _id: item },
        { _id: other },
        { _id: new Types.ObjectId() },
      ])
    const first = new Types.ObjectId()
    const second = new Types.ObjectId()
    await connection.collection("SourceItem").insertMany([
      { _id: first, source, item, externalId: "first", secret: "hidden" },
      { _id: second, source, item, externalId: "second" },
      { source: new Types.ObjectId(), item, externalId: "wrong-source" },
      { source: new Types.ObjectId(), item: other, externalId: "other" },
    ])
    const result = await connection
      .collection("Item")
      .aggregate(withSourceItems(source))
      .toArray()
    expect(result).toHaveLength(1)
    expect(result[0]._id).toEqual(item)
    expect(result[0].sourceItems).toEqual(
      expect.arrayContaining([
        { _id: first, externalId: "first" },
        { _id: second, externalId: "second" },
      ]),
    )
    expect(result[0].sourceItems).toHaveLength(2)
  })

  it("возвращает пустую выборку при отсутствии связей", async () => {
    const { connection } = getTestDatabase()
    await connection.collection("Item").insertOne({})
    expect(
      await connection
        .collection("Item")
        .aggregate(withSourceItems(new Types.ObjectId()))
        .toArray(),
    ).toEqual([])
  })
})
