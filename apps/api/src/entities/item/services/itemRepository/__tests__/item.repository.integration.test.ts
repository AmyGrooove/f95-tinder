import { beforeAll, describe, expect, it } from "@jest/globals"
import { Types } from "mongoose"
import type { HydratedDocument, Model } from "mongoose"

import {
  ItemBan,
  ItemBanSchema,
} from "@entities/itemBan/schemas/itemBan.schema"
import {
  ItemStats,
  ItemStatsSchema,
} from "@entities/itemStats/schemas/itemStats.schema"
import { ECountry } from "@entities/shared/schemas/ECountry"
import { EMediaType } from "@entities/shared/schemas/EMediaType"
import { EUserItemStatus } from "@entities/userItem/schemas/EUserItemStatus"
import {
  UserItem,
  UserItemSchema,
} from "@entities/userItem/schemas/userItem.schema"
import { getTestDatabase } from "@infrastructure/database/__tests__/setup/setupDatabase"

import { EItemType } from "../../../schemas/EItemType"
import { Item, ItemSchema } from "../../../schemas/item.schema"
import { ItemRepository } from "../core/item.repository"

describe("ItemRepository", () => {
  let repository: ItemRepository
  let model: ConstructorParameters<typeof ItemRepository>[0]

  beforeAll(() => {
    const { connection } = getTestDatabase()
    connection.model(ItemBan.name, ItemBanSchema)
    connection.model(ItemStats.name, ItemStatsSchema)
    connection.model(UserItem.name, UserItemSchema)
    model = connection.model(Item.name, ItemSchema) as unknown as Model<
      HydratedDocument<Item>
    >
    repository = new ItemRepository(model)
  })

  it("читает карточки в исходном порядке и пропускает удалённые и отсутствующие тайтлы", async () => {
    const ids = Array.from({ length: 4 }, () => new Types.ObjectId())
    const [first, second, deleted, missing] = ids
    const poster = {
      type: EMediaType.POSTER,
      url: "https://example.test/poster.jpg",
    }
    await model.collection.insertMany([
      { _id: first, type: EItemType.MOVIE, media: [poster, { type: "other" }] },
      { _id: second, type: EItemType.MOVIE },
      { _id: deleted, type: EItemType.MOVIE, deletedAt: new Date() },
    ])

    const records = await repository.findNotDeletedByIds(ids)
    expect(new Set(records.map(({ _id }) => String(_id)))).toEqual(
      new Set([String(first), String(second)]),
    )
    await expect(
      repository.readPosterCardsByIds([second, missing, first, deleted]),
    ).resolves.toEqual([
      { _id: second, type: EItemType.MOVIE, media: [] },
      { _id: first, type: EItemType.MOVIE, media: [poster] },
    ])
    await expect(repository.readPosterCardsByIds([])).resolves.toEqual([])
  })

  it("читает порцию поискового индекса после id и оставляет признак удаления для синхронизации", async () => {
    const [before, deleted, later] = ["1", "2", "3"].map(
      (digit) => new Types.ObjectId(digit.padStart(24, "0")),
    )
    const deletedAt = new Date("2026-01-01")
    await model.collection.insertMany([
      { _id: later, type: EItemType.GAME },
      { _id: before, type: EItemType.GAME },
      { _id: deleted, type: EItemType.GAME, deletedAt },
    ])
    await getTestDatabase()
      .connection.model(ItemStats.name)
      .collection.insertOne({
        item: deleted,
        ratingsCount: 3,
        ratingAverage: 7,
      })

    await expect(
      repository.readSearchIndexBatch({ afterId: before, limit: 1 }),
    ).resolves.toEqual([
      expect.objectContaining({
        _id: deleted,
        deletedAt,
        ratingsCount: 3,
        rating: 7,
      }),
    ])
  })

  it("применяет тип, статус и региональные ограничения к карточкам рекомендаций", async () => {
    const [outside, planned, blocked, game] = Array.from(
      { length: 4 },
      () => new Types.ObjectId(),
    )
    const userId = new Types.ObjectId()
    const { connection } = getTestDatabase()
    await model.collection.insertMany([
      { _id: outside, type: EItemType.MOVIE },
      { _id: planned, type: EItemType.MOVIE },
      { _id: blocked, type: EItemType.MOVIE },
      { _id: game, type: EItemType.GAME },
    ])
    await connection.model(UserItem.name).collection.insertOne({
      item: planned,
      user: userId,
      status: EUserItemStatus.PLANNED,
      rating: 8,
    })
    await connection.model(ItemBan.name).collection.insertOne({
      item: blocked,
      countries: [ECountry.RUSSIA],
    })
    const props = {
      ids: [planned, blocked, outside, game],
      types: [EItemType.MOVIE],
      userId,
      country: ECountry.RUSSIA,
    }

    await expect(
      repository.readEligibleRecommendationItems(props),
    ).resolves.toEqual([{ _id: outside, type: EItemType.MOVIE }])
    const cards = await repository.readRecommendationCards({
      ...props,
      library: {},
    })
    expect(cards).toEqual([
      expect.objectContaining({
        _id: planned,
        userStatus: EUserItemStatus.PLANNED,
        userRating: 8,
        ratingAverage: null,
      }),
      expect.objectContaining({
        _id: outside,
        userStatus: null,
        userRating: null,
        ratingAverage: null,
      }),
    ])
    const posters = await repository.readRecommendationPosterCards({
      ...props,
      country: ECountry.UNITED_STATES,
      library: {},
    })
    expect(posters.map(({ _id }) => _id)).toEqual([planned, blocked, outside])
    await expect(
      repository.readRecommendationCards({ ...props, library: { anyOf: [] } }),
    ).resolves.toEqual([])
    await expect(
      repository.readEligibleRecommendationItems({
        ...props,
        rating: { min: 9, max: 6 },
      }),
    ).rejects.toThrow(RangeError)
  })

  it("для популярных требует рейтинг, а для новинок допускает тайтлы без оценок внутри окна", async () => {
    const from = new Date("2026-02-01")
    const through = new Date("2026-02-10")
    const [rated, unrated, old] = Array.from(
      { length: 3 },
      () => new Types.ObjectId(),
    )
    await model.collection.insertMany([
      { _id: rated, type: EItemType.MOVIE, releaseDate: from },
      { _id: unrated, type: EItemType.MOVIE, releaseDate: through },
      { _id: old, type: EItemType.MOVIE, releaseDate: new Date("2026-01-31") },
    ])
    await getTestDatabase()
      .connection.model(ItemStats.name)
      .collection.insertOne({
        item: rated,
        ratingsCount: 5,
        ratingAverage: 9,
      })
    const props = {
      type: EItemType.MOVIE,
      limit: 10,
      country: ECountry.UNKNOWN,
      userId: new Types.ObjectId(),
      siteRatingAverage: null,
    }

    await expect(repository.readPopularItemIds(props)).resolves.toEqual([rated])
    await expect(
      repository.readNewItemIds({ ...props, releaseWindow: { from, through } }),
    ).resolves.toEqual([unrated, rated])
  })
})
