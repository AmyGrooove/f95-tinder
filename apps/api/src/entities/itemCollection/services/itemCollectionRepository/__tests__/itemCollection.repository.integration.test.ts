import assert from "node:assert/strict"

import { beforeAll, describe, expect, it } from "@jest/globals"
import { Types } from "mongoose"
import type { HydratedDocument, Model } from "mongoose"

import {
  Collection,
  CollectionSchema,
} from "@entities/collection/schemas/collection.schema"
import { ECollectionBlockType } from "@entities/collection/schemas/ECollectionBlockType"
import { ECollectionType } from "@entities/collection/schemas/ECollectionType"
import { EItemType } from "@entities/item/schemas/EItemType"
import { Item, ItemSchema } from "@entities/item/schemas/item.schema"
import {
  ItemStats,
  ItemStatsSchema,
} from "@entities/itemStats/schemas/itemStats.schema"
import { ELanguage } from "@entities/shared/schemas/ELanguage"
import { ESort } from "@entities/shared/types/ESort"
import { EUserItemStatus } from "@entities/userItem/schemas/EUserItemStatus"
import {
  UserItem,
  UserItemSchema,
} from "@entities/userItem/schemas/userItem.schema"
import { getTestDatabase } from "@infrastructure/database/__tests__/setup/setupDatabase"

import {
  ItemCollection,
  ItemCollectionSchema,
} from "../../../schemas/itemCollection.schema"
import { ItemCollectionRepository } from "../core/itemCollection.repository"

describe("ItemCollectionRepository", () => {
  let repository: ItemCollectionRepository

  beforeAll(async () => {
    const { connection } = getTestDatabase()
    connection.model(Item.name, ItemSchema)
    connection.model(ItemStats.name, ItemStatsSchema)
    connection.model(UserItem.name, UserItemSchema)
    connection.model(Collection.name, CollectionSchema)
    const model = connection.model(
      ItemCollection.name,
      ItemCollectionSchema,
    ) as unknown as Model<HydratedDocument<ItemCollection>>
    await model.init()
    repository = new ItemCollectionRepository(model)
  })

  it("обновляет позиции, сохраняет пропущенную заметку и очищает её пробельной строкой", async () => {
    const collectionId = new Types.ObjectId()
    const otherCollectionId = new Types.ObjectId()
    const item = new Types.ObjectId()
    const otherItem = new Types.ObjectId()
    const groupId = new Types.ObjectId()
    const entry = { item, groupId, position: 0 }
    await repository.createForCollection({
      collectionId,
      items: [
        { ...entry, note: "Keep", relevanceScore: 0.8 },
        { ...entry, item: otherItem },
      ],
    })
    await repository.createForCollection({
      collectionId: otherCollectionId,
      items: [entry],
    })
    await repository.upsertForCollection({
      collectionId,
      items: [{ ...entry, position: 2 }],
    })
    const filter = { collectionId, item }

    await expect(repository.read.findOne(filter)).resolves.toMatchObject({
      position: 2,
      note: "Keep",
      relevanceScore: 0.8,
    })
    await repository.upsertForCollection({
      collectionId,
      items: [{ ...entry, note: "  ", relevanceScore: null }],
    })
    await expect(repository.read.findOne(filter)).resolves.toMatchObject({
      position: 0,
      note: null,
      relevanceScore: null,
    })

    const selected = await repository.findByCollectionAndItems({
      collectionId,
      itemIds: [item],
    })
    expect(selected.map((entry) => entry.item)).toEqual([item])
    await repository.removeForCollection({
      collectionId,
      groupIds: [groupId],
      itemIds: [],
    })
    await expect(repository.read.checkIsExists({ collectionId })).resolves.toBe(
      false,
    )
    await expect(
      repository.read.checkIsExists({ collectionId: otherCollectionId, item }),
    ).resolves.toBe(true)
  })

  it("возвращает только действующие подборки с существующей группой тайтла", async () => {
    const item = new Types.ObjectId()
    const groupId = new Types.ObjectId()
    const [visible, orphaned, deleted] = Array.from(
      { length: 3 },
      () => new Types.ObjectId(),
    )
    const { connection } = getTestDatabase()
    const blocks = [{ id: groupId, type: ECollectionBlockType.GROUP }]
    await connection.model(Collection.name).collection.insertMany([
      { _id: visible, type: ECollectionType.CUSTOM, blocks },
      { _id: orphaned, type: ECollectionType.CUSTOM, blocks: [] },
      {
        _id: deleted,
        type: ECollectionType.CUSTOM,
        blocks,
        deletedAt: new Date(),
      },
    ])
    for (const collectionId of [visible, orphaned, deleted]) {
      await repository.createForCollection({
        collectionId,
        items: [{ item, groupId, position: 0 }],
      })
    }

    await expect(
      repository.readPublicCollectionIdsByItem(item),
    ).resolves.toEqual([visible.toHexString()])
  })

  it("учитывает видимость тайтлов, пользователя, курсор и сортировку с диапазоном оценок", async () => {
    const [collectionId, groupId, userId, first, second, deleted] = Array.from(
      { length: 6 },
      () => new Types.ObjectId(),
    )
    const { connection } = getTestDatabase()
    await connection.model(Item.name).collection.insertMany([
      { _id: first, type: EItemType.MOVIE, title: { en: "Alpha" } },
      { _id: second, type: EItemType.MOVIE, title: { en: "Zeta" } },
      { _id: deleted, type: EItemType.MOVIE, deletedAt: new Date() },
    ])
    const memberships = await repository.createForCollection({
      collectionId,
      items: [first, second, deleted].map((item, position) => ({
        item,
        position,
        groupId,
      })),
    })
    assert(Array.isArray(memberships))
    const [firstMembership] = memberships
    await connection.model(UserItem.name).collection.insertOne({
      user: userId,
      item: first,
      status: EUserItemStatus.COMPLETED,
      attempts: [{ progress: 0, unit: "minutes" }],
    })
    await connection
      .model(ItemStats.name)
      .collection.insertOne({ item: second, ratingAverage: 8 })
    const selection = { collectionId, groupIds: [groupId] }
    const page = {
      ...selection,
      limit: 5,
      isGrouped: true,
      isPersonalFilterApplied: false,
      userId,
    }

    await expect(repository.readAvailableCounts(selection)).resolves.toEqual({
      total: 2,
      completed: 0,
    })
    await expect(
      repository.readAvailableCounts(selection, userId),
    ).resolves.toEqual({ total: 2, completed: 1 })
    await expect(
      repository.readAvailableCounts({ ...selection, groupIds: [] }),
    ).resolves.toEqual({ total: 0, completed: 0 })
    const cards = await repository.readContentSlice(page)
    expect(cards.map(({ item }) => item._id)).toEqual([first, second])
    expect(cards[0].viewerItem).toMatchObject({
      status: EUserItemStatus.COMPLETED,
      progress: { value: 0, unit: "minutes" },
    })
    const after = { groupOrder: 0, position: 0, id: firstMembership._id }
    const tail = await repository.readContentSlice({ ...page, after })
    expect(tail.map(({ item }) => item._id)).toEqual([second])
    const filtered = await repository.readContentSlice({
      ...page,
      limit: 1,
      isPersonalFilterApplied: true,
    })
    expect(filtered.map(({ item }) => item._id)).toEqual([second])
    const sorted = await repository.readContentSlice({
      ...page,
      limit: 1,
      rating: { min: 7, max: 9 },
      sort: {
        field: ESort.RATING,
        language: ELanguage.ENGLISH,
        direction: -1,
        offset: 0,
      },
    })
    expect(
      sorted.map(({ item, ratingAverage }) => ({
        id: item._id,
        ratingAverage,
      })),
    ).toEqual([{ id: second, ratingAverage: 8 }])
  })
})
