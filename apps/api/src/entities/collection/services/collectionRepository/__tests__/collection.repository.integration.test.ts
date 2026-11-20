import { beforeAll, describe, expect, it } from "@jest/globals"
import { Types } from "mongoose"
import type { HydratedDocument, Model } from "mongoose"

import { Item, ItemSchema } from "@entities/item/schemas/item.schema"
import {
  ItemCollection,
  ItemCollectionSchema,
} from "@entities/itemCollection/schemas/itemCollection.schema"
import {
  UserCollection,
  UserCollectionSchema,
} from "@entities/userCollection/schemas/userCollection.schema"
import { getTestDatabase } from "@infrastructure/database/__tests__/setup/setupDatabase"

import {
  Collection,
  CollectionSchema,
} from "../../../schemas/collection.schema"
import { ECollectionBlockType } from "../../../schemas/ECollectionBlockType"
import { ECollectionType } from "../../../schemas/ECollectionType"
import { CollectionRepository } from "../core/collection.repository"

describe("CollectionRepository", () => {
  let repository: CollectionRepository
  let model: ConstructorParameters<typeof CollectionRepository>[0]

  beforeAll(async () => {
    const { connection } = getTestDatabase()
    connection.model(Item.name, ItemSchema)
    connection.model(ItemCollection.name, ItemCollectionSchema)
    connection.model(UserCollection.name, UserCollectionSchema)
    model = connection.model(
      Collection.name,
      CollectionSchema,
    ) as unknown as Model<HydratedDocument<Collection>>
    repository = new CollectionRepository(model)
    await repository.onModuleInit()
  })

  it("создаёт одну системную подборку на тег и сохраняет исходное название при повторном вызове", async () => {
    const tag = new Types.ObjectId()
    const title = { en: "First title", ru: null }
    const first = await repository.ensureForTag(tag, title)
    const repeated = await repository.ensureForTag(tag, {
      en: "Other title",
      ru: null,
    })

    expect(first).toMatchObject({
      tag,
      title,
      type: ECollectionType.TAG,
      author: null,
      blocks: [
        expect.objectContaining({
          id: expect.any(Types.ObjectId),
          type: ECollectionBlockType.GROUP,
        }),
      ],
    })
    expect(repeated).toMatchObject({ _id: first?._id, title })
    await expect(model.countDocuments({ tag }).exec()).resolves.toBe(1)
  })

  it("обновляет старую запись без версии, защищает от устаревшей записи и скрывает удалённую подборку", async () => {
    const id = new Types.ObjectId()
    const author = new Types.ObjectId()
    const title = { en: "Collection", ru: null }
    await model.collection.insertOne({
      _id: id,
      author,
      title,
      deletedAt: null,
    })
    const changes = {
      title,
      description: { en: null, ru: null },
      media: [],
      type: ECollectionType.CUSTOM,
      blocks: [],
    }
    const props = { id, authorId: author, version: 0, changes }

    await expect(
      repository.updateVersioned({ ...props, authorId: new Types.ObjectId() }),
    ).resolves.toBeNull()
    await expect(repository.updateVersioned(props)).resolves.toMatchObject({
      _id: id,
      version: 1,
    })
    await expect(repository.updateVersioned(props)).resolves.toBeNull()
    await expect(
      repository.updateVersioned({ ...props, version: 1 }),
    ).resolves.toMatchObject({ _id: id, version: 2 })
    await expect(
      repository.findNotDeletedAuthorById(id),
    ).resolves.toMatchObject({ author })
    await expect(repository.checkIsNotDeleted(id)).resolves.toBe(true)
    await expect(
      repository.softDeleteByAuthor(id, new Types.ObjectId()),
    ).resolves.toBeNull()
    await expect(
      repository.softDeleteByAuthor(id, author),
    ).resolves.toMatchObject({ _id: id })
    await expect(repository.softDeleteByAuthor(id, author)).resolves.toBeNull()
    await expect(repository.findNotDeletedById(id)).resolves.toBeNull()
    await expect(repository.findNotDeletedAuthorById(id)).resolves.toBeNull()
    await expect(repository.checkIsNotDeleted(id)).resolves.toBe(false)
  })

  it("считает тайтлы из существующих групп и выбирает только непустые системные подборки", async () => {
    const title = { en: "Collection", ru: null }
    const groupId = new Types.ObjectId()
    const blocks = [{ type: ECollectionBlockType.GROUP, id: groupId }] as const
    const [site, empty, custom, deleted] = await repository.bulk.createMany([
      { title, type: ECollectionType.FEATURE, blocks: [...blocks] },
      { title, type: ECollectionType.FEATURE },
      { title, author: new Types.ObjectId(), blocks: [...blocks] },
      {
        title,
        type: ECollectionType.FEATURE,
        blocks: [...blocks],
        deletedAt: new Date(),
      },
    ])
    const item = new Types.ObjectId()
    const deletedItem = new Types.ObjectId()
    const { connection } = getTestDatabase()
    await connection.model(Item.name).collection.insertMany([
      { _id: item, deletedAt: null },
      { _id: deletedItem, deletedAt: new Date() },
    ])
    await connection.model(ItemCollection.name).collection.insertMany([
      { collectionId: site._id, groupId, item },
      { collectionId: site._id, groupId, item: deletedItem },
      {
        collectionId: site._id,
        groupId: new Types.ObjectId(),
        item: new Types.ObjectId(),
      },
      { collectionId: custom._id, groupId, item },
      { collectionId: deleted._id, groupId, item },
    ])

    await expect(
      repository.sampleAvailableSiteCollectionIds(10),
    ).resolves.toEqual([{ _id: site._id }])
    const counts = await repository.readAvailableItemCountsByIds([
      site._id,
      empty._id,
      custom._id,
      deleted._id,
    ])
    expect(counts).toHaveLength(3)
    expect(counts).toEqual(
      expect.arrayContaining([
        { _id: site._id, itemCount: 1 },
        { _id: empty._id, itemCount: 0 },
        { _id: custom._id, itemCount: 1 },
      ]),
    )
  })

  it("различает среднюю оценку, отсутствие оценок и удалённую подборку", async () => {
    const title = { en: "Collection", ru: null }
    const [rated, unrated, deleted] = await repository.bulk.createMany([
      { title },
      { title },
      { title, deletedAt: new Date() },
    ])
    await getTestDatabase()
      .connection.model(UserCollection.name)
      .collection.insertMany([
        { user: new Types.ObjectId(), collectionId: rated._id, rating: 6 },
        { user: new Types.ObjectId(), collectionId: rated._id, rating: null },
        { user: new Types.ObjectId(), collectionId: rated._id, rating: 10 },
        { user: new Types.ObjectId(), collectionId: deleted._id, rating: 9 },
      ])

    await expect(repository.readRatingAveragesByIds([])).resolves.toEqual(
      new Map(),
    )
    await expect(
      repository.readRatingAveragesByIds([rated._id, unrated._id, deleted._id]),
    ).resolves.toEqual(
      new Map([
        [rated._id.toHexString(), 8],
        [unrated._id.toHexString(), null],
      ]),
    )
  })
})
