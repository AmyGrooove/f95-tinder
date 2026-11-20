import { beforeAll, describe, expect, it } from "@jest/globals"
import { Types } from "mongoose"
import type { HydratedDocument, Model } from "mongoose"

import { EItemType } from "@entities/item/schemas/EItemType"
import { Item, ItemSchema } from "@entities/item/schemas/item.schema"
import { ELanguage } from "@entities/shared/schemas/ELanguage"
import { ESort } from "@entities/shared/types/ESort"
import { getTestDatabase } from "@infrastructure/database/__tests__/setup/setupDatabase"

import { EUserItemStatus } from "../../../schemas/EUserItemStatus"
import { UserItem, UserItemSchema } from "../../../schemas/userItem.schema"
import { UserItemRepository } from "../core/userItem.repository"

describe("UserItemRepository", () => {
  let repository: UserItemRepository
  let model: ConstructorParameters<typeof UserItemRepository>[0]

  beforeAll(() => {
    const { connection } = getTestDatabase()
    connection.model(Item.name, ItemSchema)
    model = connection.model(UserItem.name, UserItemSchema) as unknown as Model<
      HydratedDocument<UserItem>
    >
    repository = new UserItemRepository(model)
  })

  it("выбирает приоритетный статус продолжения среди видимых тайтлов нужного типа", async () => {
    const [user, planned, onHold, inProgress] = Array.from(
      { length: 4 },
      () => new Types.ObjectId(),
    )
    await getTestDatabase()
      .connection.model(Item.name)
      .collection.insertMany([
        { _id: planned, type: EItemType.MOVIE },
        { _id: onHold, type: EItemType.SERIES },
        { _id: inProgress, type: EItemType.MOVIE, deletedAt: new Date() },
      ])
    await repository.bulk.createMany([
      { user, item: planned, status: EUserItemStatus.PLANNED },
      { user, item: onHold, status: EUserItemStatus.ON_HOLD },
      { user, item: inProgress, status: EUserItemStatus.IN_PROGRESS },
    ])

    await expect(repository.readLibraryContinueStatus(user)).resolves.toBe(
      EUserItemStatus.ON_HOLD,
    )
    await expect(
      repository.readLibraryContinueStatus(user, [EItemType.MOVIE]),
    ).resolves.toBe(EUserItemStatus.PLANNED)
    await expect(
      repository.readLibraryContinueStatus(user, [EItemType.GAME]),
    ).resolves.toBeNull()
  })

  it("сводит оценки и избранное по видимым записям библиотеки пользователя", async () => {
    const [user, planned, completed, deleted, blocked] = Array.from(
      { length: 5 },
      () => new Types.ObjectId(),
    )
    await getTestDatabase()
      .connection.model(Item.name)
      .collection.insertMany([
        { _id: planned, type: EItemType.MOVIE },
        { _id: completed, type: EItemType.MOVIE },
        { _id: deleted, type: EItemType.MOVIE, deletedAt: new Date() },
        { _id: blocked, type: EItemType.MOVIE },
      ])
    await repository.bulk.createMany([
      { user, item: planned, status: EUserItemStatus.PLANNED },
      {
        user,
        item: completed,
        status: EUserItemStatus.COMPLETED,
        rating: 8,
        isFavorite: true,
      },
      {
        user,
        item: deleted,
        status: EUserItemStatus.COMPLETED,
        rating: 9,
        isFavorite: true,
      },
      { user, item: blocked, status: EUserItemStatus.BLOCKED },
      {
        user: new Types.ObjectId(),
        item: completed,
        status: EUserItemStatus.COMPLETED,
        rating: 10,
      },
    ])

    await expect(repository.readLibrarySummary(user)).resolves.toEqual({
      statusCounts: {
        planned: 1,
        inProgress: 0,
        onHold: 0,
        completed: 1,
        dropped: 0,
      },
      ratingsCount: 1,
      favoritesCount: 1,
    })
    await expect(repository.readPlannedItemIds(user)).resolves.toEqual([
      planned,
    ])
  })

  it("считает сигналами высокие оценки и допустимое избранное, исключая пропуски и чужие записи", async () => {
    const user = new Types.ObjectId()
    const completed = { user, status: EUserItemStatus.COMPLETED }
    const [
      high,
      favoriteWithoutRating,
      favoriteAtThreshold,
      low,
      middle,
      skipped,
      other,
    ] = Array.from({ length: 7 }, () => new Types.ObjectId())
    await model.collection.insertMany([
      { ...completed, item: high, rating: 8 },
      {
        ...completed,
        item: favoriteWithoutRating,
        isFavorite: true,
        rating: null,
      },
      { ...completed, item: favoriteAtThreshold, isFavorite: true, rating: 5 },
      { ...completed, item: low, isFavorite: true, rating: 4 },
      { ...completed, item: middle, rating: 7 },
      {
        ...completed,
        item: skipped,
        status: EUserItemStatus.SKIPPED,
        rating: 10,
      },
      { ...completed, item: other, user: new Types.ObjectId(), rating: 10 },
    ])

    const ids = await repository.readPositiveRecommendationItemIds(user)
    expect(new Set(ids.map(String))).toEqual(
      new Set([high, favoriteWithoutRating, favoriteAtThreshold].map(String)),
    )
  })

  it("экранирует поиск, сортирует оценки с пустыми в конце и скрывает прогресс по запросу", async () => {
    const [user, rated, unrated, excluded] = Array.from(
      { length: 4 },
      () => new Types.ObjectId(),
    )
    await getTestDatabase()
      .connection.model(Item.name)
      .collection.insertMany([
        {
          _id: rated,
          type: EItemType.MOVIE,
          title: { en: "A+B" },
          movie: { duration: 95 },
        },
        {
          _id: unrated,
          type: EItemType.MOVIE,
          title: { en: "Other" },
          aliases: ["A+B"],
        },
        { _id: excluded, type: EItemType.MOVIE, title: { en: "AAAB" } },
      ])
    const common = {
      user,
      status: EUserItemStatus.IN_PROGRESS,
      isFavorite: true,
    }
    await model.collection.insertMany([
      { ...common, item: unrated, rating: null },
      {
        ...common,
        item: rated,
        rating: 5,
        attempts: [
          { progress: 20, unit: "minutes" },
          { progress: 0, unit: "minutes" },
        ],
      },
      { ...common, item: excluded, rating: 9 },
    ])
    const options = {
      userId: user,
      statuses: [EUserItemStatus.IN_PROGRESS],
      types: [EItemType.MOVIE],
      isProgressVisible: true,
      isFavorite: true,
      search: "a+b",
      sort: ESort.RATING,
      direction: 1,
      language: ELanguage.ENGLISH,
      limit: 1,
      offset: 0,
    } as const

    const page = await repository.readLibraryPage(options)
    expect(page).toHaveLength(2)
    expect(page.map(({ item }) => item._id)).toEqual([rated, unrated])
    expect(page[0]).toMatchObject({
      movieDuration: 95,
      progress: { value: 0, unit: "minutes" },
    })

    const publicPage = await repository.readLibraryPage({
      ...options,
      isProgressVisible: false,
    })
    expect(publicPage.map(({ progress }) => progress)).toEqual([null, null])
    const unratedPage = await repository.readLibraryPage({
      ...options,
      isUnrated: true,
    })
    expect(unratedPage.map(({ item }) => item._id)).toEqual([unrated])
  })
})
