import { setTimeout } from "node:timers/promises"

import { afterAll, beforeAll, describe, expect, it } from "@jest/globals"
import { getConnectionToken } from "@nestjs/mongoose"
import { Test, type TestingModule } from "@nestjs/testing"
import { RedisToken } from "@nestjs-redis/client"
import { mongo, Types } from "mongoose"

import { RecommendationsModule } from "@endpoints/recommendations/recommendations.module"
import {
  RecommendationsService,
  RecommendationCursorExpiredError,
} from "@endpoints/recommendations/services/recommendationsService"
import { EItemType } from "@entities/item/schemas/EItemType"
import { ECountry } from "@entities/shared/schemas/ECountry"
import { EUserItemStatus } from "@entities/userItem/schemas/EUserItemStatus"
import { getTestRedis } from "@infrastructure/cache/__tests__/setup/setupRedis"
import { createTestConfiguration } from "@infrastructure/config/__tests__/setup/createTestConfiguration"
import { infrastructureConfiguration } from "@infrastructure/config/config.module"
import { getTestDatabase } from "@infrastructure/database/__tests__/setup/setupDatabase"
import { TestMailModule } from "@infrastructure/mail/__tests__/setup/TestMailModule/testMail.module"
import { MailModule } from "@infrastructure/mail/mail.module"
import { SecurityJwtService } from "@infrastructure/security/services/jwtService"

import { RecommendationFeedService } from "../core/recommendationFeed.service"

describe("RecommendationFeedService", () => {
  const createTrainerModelBson = (
    sourceIds: readonly Types.ObjectId[],
    candidateIds: readonly Types.ObjectId[],
    trainedAt: Date,
  ) => {
    const itemIds = [...sourceIds, ...candidateIds].map(String)
    const offsets = Buffer.alloc((itemIds.length + 1) * 4)
    const itemFactors = Buffer.alloc(itemIds.length * 4)
    const popularity = Buffer.alloc(itemIds.length * 4)

    for (const [index] of candidateIds.entries()) {
      popularity.writeFloatLE(
        candidateIds.length - index,
        (sourceIds.length + index) * 4,
      )
    }

    return mongo.BSON.serialize({
      _id: new Types.ObjectId(),
      trainedAt,
      createdAt: trainedAt,
      updatedAt: trainedAt,
      formatVersion: 1,
      source: "json",
      itemIds,
      itemCF: {
        maxNeighbors: 100,
        shrink: 10,
        offsets,
        indices: Buffer.alloc(0),
        weights: Buffer.alloc(0),
      },
      als: { factors: 1, alpha: 2, regularization: 1, itemFactors },
      popularity,
    })
  }

  let moduleRef: TestingModule | undefined
  let feed: RecommendationFeedService
  let recommendations: RecommendationsService
  let jwt: SecurityJwtService

  beforeAll(async () => {
    const { connection, uri } = getTestDatabase()
    const { url, connect } = getTestRedis()
    const authRedis = await connect()
    moduleRef = await Test.createTestingModule({
      imports: [RecommendationsModule],
    })
      .overrideModule(MailModule)
      .useModule(TestMailModule)
      .overrideProvider(infrastructureConfiguration.KEY)
      .useValue(createTestConfiguration(uri, url))
      .overrideProvider(getConnectionToken())
      .useValue(connection)
      .overrideProvider(RedisToken("auth"))
      .useValue(authRedis)
      .compile()
    await moduleRef.init()
    feed = moduleRef.get(RecommendationFeedService)
    recommendations = moduleRef.get(RecommendationsService)
    jwt = moduleRef.get(SecurityJwtService)
    await Promise.all(
      Object.values(connection.models).map((model) => model.init()),
    )
  }, 60_000)

  afterAll(async () => {
    await moduleRef?.close()
  })

  const createViewer = async () => {
    const { connection } = getTestDatabase()
    const user = new Types.ObjectId()
    const session = new Types.ObjectId()
    await connection.collection("User").insertOne({ _id: user })
    await connection.collection("UserSession").insertOne({
      _id: session,
      user,
      country: ECountry.GEORGIA,
      expiresAt: new Date(Date.now() + 60_000),
    })

    const token = await jwt.signAccessToken({
      sub: user.toHexString(),
      sessionId: session.toHexString(),
      role: "user",
    })
    return { user, token }
  }

  const createItem = (
    props: { type?: EItemType; releaseDate?: Date; deletedAt?: Date } = {},
  ) => ({
    _id: new Types.ObjectId(),
    type: EItemType.MOVIE,
    title: { ru: "Произведение", en: null },
    media: [],
    deletedAt: null,
    ...props,
  })

  it("применяет общую допустимость к популярным и новинкам, а окно релиза только к новинкам", async () => {
    const { connection } = getTestDatabase()
    const { user, token } = await createViewer()
    const now = Date.now()
    const day = 86_400_000
    const recent = { releaseDate: new Date(now - day) }
    const outside = createItem(recent)
    const planned = createItem(recent)
    const completed = createItem(recent)
    const skipped = createItem(recent)
    const expired = createItem(recent)
    const blocked = createItem(recent)
    const countryBan = createItem(recent)
    const globalBan = createItem(recent)
    const foreignBan = createItem(recent)
    const old = createItem({ releaseDate: new Date(now - 91 * day) })
    const withinWindow = createItem({ releaseDate: new Date(now - 89 * day) })
    const future = createItem({ releaseDate: new Date(now + day) })
    const deleted = createItem({ ...recent, deletedAt: new Date() })
    const unrated = createItem(recent)
    const otherType = createItem({ ...recent, type: EItemType.GAME })
    const items = [
      outside,
      planned,
      completed,
      skipped,
      expired,
      blocked,
      countryBan,
      globalBan,
      foreignBan,
      old,
      withinWindow,
      future,
      deleted,
      unrated,
      otherType,
    ]
    await connection.collection("Item").insertMany(items)
    await connection.collection("ItemStats").insertMany(
      items
        .filter(({ _id }) => !_id.equals(unrated._id))
        .map(({ _id }) => ({
          item: _id,
          ratingsCount: 10,
          ratingAverage: 8,
        })),
    )
    await connection.collection("ItemBan").insertMany([
      { item: countryBan._id, countries: [ECountry.GEORGIA] },
      { item: globalBan._id, countries: [] },
      { item: foreignBan._id, countries: [ECountry.ARMENIA] },
    ])
    await connection.collection("UserItem").insertMany([
      { user, item: planned._id, status: EUserItemStatus.PLANNED },
      { user, item: completed._id, status: EUserItemStatus.COMPLETED },
      {
        user,
        item: skipped._id,
        status: EUserItemStatus.SKIPPED,
        expiresAt: new Date(now + day),
      },
      {
        user,
        item: expired._id,
        status: EUserItemStatus.SKIPPED,
        expiresAt: new Date(now - day),
      },
      { user, item: blocked._id, status: EUserItemStatus.BLOCKED },
      {
        user: new Types.ObjectId(),
        item: outside._id,
        status: EUserItemStatus.BLOCKED,
      },
    ])
    const type = EItemType.MOVIE
    const mixed = {
      type,
      filter: { library: { anyOf: ["outside", EUserItemStatus.PLANNED] } },
    } as const
    const ids = (values: readonly { _id: Types.ObjectId }[]) =>
      values.map(({ _id }) => String(_id)).sort()
    const popular = await recommendations.readPopularItemIds(token, mixed)
    const releases = await recommendations.readNewItemIds(token, mixed)

    expect(popular.map(String).sort()).toEqual(
      ids([outside, planned, expired, foreignBan, old, withinWindow, future]),
    )
    expect(releases.map(String).sort()).toEqual(
      ids([outside, planned, expired, foreignBan, withinWindow, unrated]),
    )
    const libraryOnly = {
      type,
      filter: { library: { anyOf: [EUserItemStatus.COMPLETED] } },
    } as const
    await expect(
      recommendations.readPopularItemIds(token, libraryOnly),
    ).resolves.toEqual([completed._id])
    await expect(
      recommendations.readNewItemIds(token, libraryOnly),
    ).resolves.toEqual([completed._id])

    const tag = new Types.ObjectId()
    await connection.collection("Tag").insertOne({ _id: tag })
    await connection
      .collection("TagItem")
      .insertMany(
        [outside, planned, unrated].map(({ _id }) => ({ item: _id, tag })),
      )
    await connection
      .collection("ItemStats")
      .updateOne({ item: planned._id }, { $set: { ratingAverage: 7 } })
    const filtered = {
      type,
      filter: {
        ...mixed.filter,
        tags: [{ allOf: [tag] }],
        rating: { min: 8, max: 8 },
      },
    }
    await expect(
      recommendations.readPopularItemIds(token, filtered),
    ).resolves.toEqual([outside._id])
    await expect(
      recommendations.readNewItemIds(token, filtered),
    ).resolves.toEqual([outside._id])
  })

  it("переходит к личной выдаче при пятом актуальном сигнале об известном существующем произведении", async () => {
    const { connection } = getTestDatabase()
    const { user, token } = await createViewer()
    const sources = Array.from({ length: 5 }, () => createItem())
    const missing = createItem()
    const deleted = createItem({ deletedAt: new Date() })
    const unknown = createItem()
    const candidate = createItem()
    await connection
      .collection("Item")
      .insertMany([...sources, deleted, unknown, candidate])
    const [, unratedFavorite, ratedFavorite, highlyRated, belowThreshold] =
      sources
    const history = connection.collection("UserItem")
    await history.insertMany([
      {
        user,
        item: sources[0]._id,
        status: EUserItemStatus.COMPLETED,
        rating: 8,
      },
      {
        user,
        item: unratedFavorite._id,
        status: EUserItemStatus.COMPLETED,
        rating: null,
        isFavorite: true,
      },
      {
        user,
        item: ratedFavorite._id,
        status: EUserItemStatus.COMPLETED,
        rating: 5,
        isFavorite: true,
      },
      {
        user,
        item: highlyRated._id,
        status: EUserItemStatus.COMPLETED,
        rating: 10,
      },
      {
        user,
        item: belowThreshold._id,
        status: EUserItemStatus.COMPLETED,
        rating: 4,
        isFavorite: true,
      },
      ...[unknown, missing, deleted].map(({ _id }) => ({
        user,
        item: _id,
        status: EUserItemStatus.COMPLETED,
        rating: 9,
      })),
      {
        user: new Types.ObjectId(),
        item: belowThreshold._id,
        status: EUserItemStatus.COMPLETED,
        rating: 10,
      },
    ])
    const modelSources = [...sources, missing, deleted].map(({ _id }) => _id)
    const models = connection.collection("RecommendationModel")
    for (const bson of [
      createTrainerModelBson(
        modelSources,
        [candidate._id],
        new Date("2026-01-02"),
      ),
      createTrainerModelBson(modelSources, [], new Date("2026-01-01")),
    ]) {
      await models.insertOne(mongo.BSON.deserialize(bson))
    }
    const props = { filter: { types: [EItemType.MOVIE] } }

    await expect(feed.readPage(token, props)).resolves.toEqual({
      items: [],
      count: 0,
      nextCursor: null,
    })
    await history.updateOne(
      { user, item: belowThreshold._id },
      { $set: { rating: 5 } },
    )
    expect(
      (await feed.readPage(token, props)).items.map(({ _id }) => _id),
    ).toEqual([candidate._id])
    await history.insertOne({
      user,
      item: candidate._id,
      status: EUserItemStatus.PLANNED,
    })
    await expect(feed.readPage(token, props)).resolves.toEqual({
      items: [],
      count: 0,
      nextCursor: null,
    })
    const plannedOnly = {
      filter: {
        ...props.filter,
        library: { anyOf: [EUserItemStatus.PLANNED] },
      },
    } as const
    expect(
      (await feed.readPage(token, plannedOnly)).items.map(({ _id }) => _id),
    ).toEqual([candidate._id])
    await history.updateOne(
      { user, item: belowThreshold._id },
      {
        $set: {
          status: EUserItemStatus.SKIPPED,
          rating: 10,
          expiresAt: new Date(Date.now() + 60_000),
        },
      },
    )
    await expect(feed.readPage(token, plannedOnly)).resolves.toEqual({
      items: [],
      count: 0,
      nextCursor: null,
    })
  })

  it("продвигает прямые сиквелы допустимых источников и продолжает фиксированные порции до истечения Redis TTL", async () => {
    const { connection } = getTestDatabase()
    const { redis } = getTestRedis()
    const { user, token } = await createViewer()
    const sources = Array.from({ length: 7 }, () => createItem())
    const candidates = Array.from({ length: 14 }, () => createItem())
    const [source, , , , , bannedSource, blockedSource] = sources
    const [
      ordinary,
      reversed,
      indirect,
      fromBanned,
      fromBlocked,
      directFirst,
      directSecond,
    ] = candidates
    await connection.collection("Item").insertMany([...sources, ...candidates])
    await connection.collection("UserItem").insertMany(
      sources.map(({ _id }) => ({
        user,
        item: _id,
        rating: 9,
        status: _id.equals(blockedSource._id)
          ? EUserItemStatus.BLOCKED
          : EUserItemStatus.COMPLETED,
      })),
    )
    await connection
      .collection("ItemBan")
      .insertOne({ item: bannedSource._id, countries: [ECountry.GEORGIA] })
    const sequel = new Types.ObjectId()
    const prequel = new Types.ObjectId()
    await connection.collection("Relation").insertMany([
      { _id: sequel, key: "sequel" },
      { _id: prequel, key: "prequel" },
    ])
    const link = (
      first: typeof source,
      firstRole: Types.ObjectId,
      second: typeof source,
      secondRole: Types.ObjectId,
    ) => ({
      first: { item: first._id, role: firstRole },
      second: { item: second._id, role: secondRole },
    })
    await connection
      .collection("ItemRelation")
      .insertMany([
        link(directFirst, sequel, source, prequel),
        link(source, prequel, directSecond, sequel),
        link(source, sequel, reversed, prequel),
        link(directFirst, prequel, indirect, sequel),
        link(bannedSource, prequel, fromBanned, sequel),
        link(blockedSource, prequel, fromBlocked, sequel),
      ])
    const bson = createTrainerModelBson(
      sources.map(({ _id }) => _id),
      candidates.map(({ _id }) => _id),
      new Date(),
    )
    await connection
      .collection("RecommendationModel")
      .insertOne(mongo.BSON.deserialize(bson))
    const props = { limit: 10, filter: { types: [EItemType.MOVIE] } } as const
    const firstPage = await feed.readPage(token, props)

    expect(firstPage.items.map(({ _id }) => _id)).toEqual(
      [
        directFirst,
        directSecond,
        ordinary,
        reversed,
        indirect,
        fromBanned,
        fromBlocked,
        ...candidates.slice(7, 10),
      ].map(({ _id }) => _id),
    )
    expect(firstPage.count).toBe(10)
    if (firstPage.nextCursor === null) {
      throw new Error("Ожидался курсор второй порции")
    }
    const keys = await redis.keys("*")
    expect(keys).toHaveLength(1)
    const [key] = keys
    const ttl = await redis.pTTL(key)
    expect(ttl).toBeGreaterThan(0)
    expect(ttl).toBeLessThanOrEqual(600_000)

    await connection.collection("UserItem").insertOne({
      user,
      item: candidates[10]._id,
      status: EUserItemStatus.BLOCKED,
    })
    const next = { ...props, cursor: firstPage.nextCursor }
    const secondPage = await feed.readPage(token, next)
    expect(secondPage.items.map(({ _id }) => _id)).toEqual(
      candidates.slice(11).map(({ _id }) => _id),
    )
    expect(secondPage).toMatchObject({ count: 3, nextCursor: null })
    expect(await redis.pTTL(key)).toBeLessThanOrEqual(ttl)

    await redis.pExpire(key, 50)
    await setTimeout(100)
    await expect(feed.readPage(token, next)).rejects.toThrow(
      RecommendationCursorExpiredError,
    )
    expect(await redis.dbSize()).toBe(0)
  })
})
