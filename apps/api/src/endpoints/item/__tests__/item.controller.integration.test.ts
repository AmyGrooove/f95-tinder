import { describe, expect, it } from "@jest/globals"
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger"
import { Types } from "mongoose"

import { EFeatureValueType } from "@entities/feature/schemas/EFeatureValueType"
import { EFeatureGroup } from "@entities/feature/schemas/EFeatureGroup"
import type { Item } from "@entities/item/schemas/item.schema"
import { EItemType } from "@entities/item/schemas/EItemType"
import { EItemRelationRoleGroup } from "@entities/itemRelationRole/schemas/EItemRelationRoleGroup"
import type { TCreateRelationSide } from "@entities/relation/schemas/relationSide.schema"
import { EMediaType } from "@entities/shared/schemas/EMediaType"
import { EUnit } from "@entities/shared/schemas/EUnit"
import type { LanguageText } from "@entities/shared/schemas/languageText.schema"
import { ETagGroup } from "@entities/tag/schemas/ETagGroup"
import { createAccount } from "@endpoints/account/__tests__/functions/createAccount"
import { getTestApplication } from "@test/setup/setupIntegration"

import type { ItemResponseDto } from "../dto/response/item.response"

describe("ItemController HTTP", () => {
  const createItem = async (overrides: Partial<Item> = {}) => {
    const { connection } = getTestApplication()
    const item = {
      _id: new Types.ObjectId(),
      type: EItemType.MOVIE,
      title: { ru: "Фильм", en: null },
      description: { ru: null, en: null },
      aliases: [],
      media: [],
      deletedAt: null,
      createdAt: new Date("2026-10-25T00:00:00.000Z"),
      updatedAt: new Date("2026-10-25T00:00:00.000Z"),
      ...overrides,
    }
    await connection.collection("Item").insertOne(item)

    return item
  }

  const createFeature = async (props: {
    item: Types.ObjectId
    key: string
    value: string | number | boolean | Date
    valueType: EFeatureValueType
    unit?: EUnit | null
  }) => {
    const { connection } = getTestApplication()
    const feature = {
      _id: new Types.ObjectId(),
      key: props.key,
      name: { ru: props.key, en: null },
      valueType: props.valueType,
      unit: props.unit ?? null,
      group: EFeatureGroup.TECHNICAL,
      description: { ru: "Описание характеристики", en: null },
    }
    await connection.collection("Feature").insertOne(feature)
    await connection
      .collection("ItemFeature")
      .insertOne({ item: props.item, feature: feature._id, value: props.value })

    return feature
  }

  const createTag = async (props: {
    key: string
    id?: Types.ObjectId
    item?: Types.ObjectId
    relevanceScore?: number
    group?: ETagGroup | null
  }) => {
    const { connection } = getTestApplication()
    const tag = {
      _id: props.id ?? new Types.ObjectId(),
      key: props.key,
      name: { ru: props.key, en: null },
      group: props.group ?? null,
      aliases: ["Альтернативный тег"],
      description: { ru: "Описание тега", en: null },
      embedding: { model: "internal", vector: [1, 2, 3] },
    }
    await connection.collection("Tag").insertOne(tag)

    if (props.item !== undefined) {
      await connection.collection("ItemTag").insertOne({
        item: props.item,
        tag: tag._id,
        relevanceScore: props.relevanceScore ?? 1,
      })
    }

    return tag
  }

  const createRole = async (props: { key: string; name: LanguageText }) => {
    const role = {
      _id: new Types.ObjectId(),
      key: props.key,
      name: props.name,
      group: EItemRelationRoleGroup.VIDEO,
      description: { ru: "Описание роли", en: null },
    }
    await getTestApplication()
      .connection.collection("ItemRelationRole")
      .insertOne(role)

    return role
  }

  const createRelation = async (props: {
    first: TCreateRelationSide
    second: TCreateRelationSide
    id?: Types.ObjectId
  }) => {
    const relation = {
      _id: props.id ?? new Types.ObjectId(),
      first: props.first,
      second: props.second,
    }
    await getTestApplication()
      .connection.collection("Relation")
      .insertOne(relation)

    return relation
  }

  it("возвращает гостю точный публичный ответ с пустыми блоками без проверки cookie", async () => {
    const { app } = getTestApplication()
    const item = await createItem()
    const response = await app.inject({
      method: "GET",
      url: `/items/${item._id}`,
      headers: { cookie: "__Host-accessToken=invalid" },
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers["cache-control"]).toBe("no-store")
    expect(response.headers["set-cookie"]).toBeUndefined()
    expect(response.json()).toEqual({
      id: item._id.toHexString(),
      type: "movie",
      title: { ru: "Фильм", en: null },
      description: { ru: null, en: null },
      aliases: [],
      media: [],
      tags: [],
      features: [],
      relations: [],
    })
  })

  it("принимает ID в верхнем регистре и возвращает нормализованный ID", async () => {
    const { app } = getTestApplication()
    const item = await createItem({
      _id: new Types.ObjectId("abcdefabcdefabcdefabcdef"),
    })
    const response = await app.inject({
      method: "GET",
      url: `/items/${item._id.toHexString().toUpperCase()}`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ id: "abcdefabcdefabcdefabcdef" })
  })

  it.each([
    "invalid",
    "abcdefghijkl",
    "0".repeat(23),
    "0".repeat(25),
    "g".repeat(24),
    "%20" + "0".repeat(24),
    "0".repeat(24) + "%20",
  ])("возвращает структурированный 400 для некорректного ID %s", async (id) => {
    const response = await getTestApplication().app.inject({
      method: "GET",
      url: `/items/${id}`,
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({
      error: {
        code: "BAD_REQUEST",
        message: expect.any(String),
        details: null,
        requestId: expect.any(String),
      },
    })
  })

  it("возвращает одинаковый 404 для отсутствующего и удалённого произведения", async () => {
    const { app } = getTestApplication()
    const deleted = await createItem({ deletedAt: new Date() })

    for (const id of [new Types.ObjectId(), deleted._id]) {
      const response = await app.inject({ method: "GET", url: `/items/${id}` })

      expect(response.statusCode).toBe(404)
      expect(response.json()).toEqual({
        error: {
          code: "NOT_FOUND",
          message: "Произведение не найдено или удалено",
          details: null,
          requestId: expect.any(String),
        },
      })
    }
  })

  it("возвращает nullable-переводы, альтернативные названия и медиа в сохранённом порядке", async () => {
    const { app } = getTestApplication()
    const item = await createItem({
      title: { ru: null, en: "Original title" },
      description: { ru: "Описание", en: null },
      aliases: ["Zulu", "Альтернативное название", "Alpha"],
      media: [
        { src: "/frame.webp", language: null, type: EMediaType.SCREENSHOT },
        { src: "/trailer.mp4", language: "en", type: EMediaType.TRAILER },
        { src: "/poster.webp", language: "ru", type: EMediaType.POSTER },
      ],
    })
    const response = await app.inject({
      method: "GET",
      url: `/items/${item._id}`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      title: { ru: null, en: "Original title" },
      description: { ru: "Описание", en: null },
      aliases: ["Zulu", "Альтернативное название", "Alpha"],
      media: item.media,
    })
    expect(response.json()).not.toHaveProperty("backdrop")
  })

  it("сериализует отсутствующие переводы и необязательные массивы без значений undefined", async () => {
    const { app, connection } = getTestApplication()
    const item = await createItem({ title: { ru: null, en: "Original" } })
    await connection.collection("Item").updateOne(
      { _id: item._id },
      {
        $unset: {
          "title.ru": "",
          description: "",
          aliases: "",
          media: "",
          deletedAt: "",
        },
      },
    )

    const response = await app.inject({
      method: "GET",
      url: `/items/${item._id}`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      id: item._id.toHexString(),
      type: "movie",
      title: { ru: null, en: "Original" },
      description: { ru: null, en: null },
      aliases: [],
      media: [],
      tags: [],
      features: [],
      relations: [],
    })
  })

  it("возвращает только прямые теги нужного Item, сортируя по релевантности и ID тега", async () => {
    const { app, connection } = getTestApplication()
    const item = await createItem()
    const other = await createItem()
    const low = await createTag({
      item: item._id,
      key: "low",
      relevanceScore: 0,
    })
    const higherId = await createTag({
      item: item._id,
      key: "higherId",
      relevanceScore: 1,
      id: new Types.ObjectId("000000000000000000000020"),
      group: ETagGroup.COUNTRY,
    })
    const lowerId = await createTag({
      item: item._id,
      key: "lowerId",
      relevanceScore: 1,
      id: new Types.ObjectId("000000000000000000000010"),
      group: ETagGroup.GENRE,
    })
    const parent = await createTag({ key: "parent" })
    await createTag({ item: other._id, key: "other" })
    await connection
      .collection("TagRelation")
      .insertOne({ first: lowerId._id, second: parent._id, type: "parent" })

    const response = await app.inject({
      method: "GET",
      url: `/items/${item._id}`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json<ItemResponseDto>().tags).toEqual(
      [lowerId, higherId, low].map((tag) => ({
        id: tag._id.toHexString(),
        key: tag.key,
        group: tag.group,
        name: tag.name,
      })),
    )
  })

  it("пропускает привязки к отсутствующим тегам и сохраняет nullable-группу и переводы", async () => {
    const { app, connection } = getTestApplication()
    const item = await createItem()
    const tag = await createTag({ item: item._id, key: "tag" })
    await connection.collection("ItemTag").insertOne({
      item: item._id,
      tag: new Types.ObjectId(),
      relevanceScore: 1,
    })
    await connection
      .collection("Tag")
      .updateOne(
        { _id: tag._id },
        { $unset: { group: "", "name.ru": "" }, $set: { "name.en": "Tag" } },
      )

    const response = await app.inject({
      method: "GET",
      url: `/items/${item._id}`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json<ItemResponseDto>().tags).toEqual([
      {
        id: tag._id.toHexString(),
        key: "tag",
        group: null,
        name: { ru: null, en: "Tag" },
      },
    ])
  })

  it("возвращает характеристики шапки по key, сериализуя дату в ISO 8601", async () => {
    const { app } = getTestApplication()
    const item = await createItem()
    const other = await createItem()
    const releaseStatus = await createFeature({
      item: item._id,
      key: "releaseStatus",
      valueType: EFeatureValueType.STRING,
      value: "released",
    })
    const releaseDate = await createFeature({
      item: item._id,
      key: "releaseDate",
      valueType: EFeatureValueType.DATE,
      value: new Date("2026-10-25T12:30:00+03:00"),
    })
    const duration = await createFeature({
      item: item._id,
      key: "duration",
      valueType: EFeatureValueType.NUMBER,
      value: 120,
      unit: EUnit.MINUTE,
    })
    const ageRating = await createFeature({
      item: item._id,
      key: "ageRating",
      valueType: EFeatureValueType.STRING,
      value: "16+",
    })
    await createFeature({
      item: other._id,
      key: "other",
      valueType: EFeatureValueType.NUMBER,
      value: 999,
    })

    const response = await app.inject({
      method: "GET",
      url: `/items/${item._id}`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json<ItemResponseDto>().features).toEqual([
      {
        id: ageRating._id.toHexString(),
        key: "ageRating",
        name: ageRating.name,
        valueType: "string",
        unit: null,
        value: "16+",
      },
      {
        id: duration._id.toHexString(),
        key: "duration",
        name: duration.name,
        valueType: "number",
        unit: "minute",
        value: 120,
      },
      {
        id: releaseDate._id.toHexString(),
        key: "releaseDate",
        name: releaseDate.name,
        valueType: "date",
        unit: null,
        value: "2026-10-25T09:30:00.000Z",
      },
      {
        id: releaseStatus._id.toHexString(),
        key: "releaseStatus",
        name: releaseStatus.name,
        valueType: "string",
        unit: null,
        value: "released",
      },
    ])
    for (const key of [
      "ageRating",
      "duration",
      "releaseDate",
      "releaseStatus",
    ]) {
      expect(response.json()).not.toHaveProperty(key)
    }
  })

  it("возвращает null для отсутствующей единицы и переводов характеристики", async () => {
    const { app, connection } = getTestApplication()
    const item = await createItem()
    const feature = await createFeature({
      item: item._id,
      key: "duration",
      valueType: EFeatureValueType.NUMBER,
      value: 120,
    })
    await connection.collection("Feature").updateOne(
      { _id: feature._id },
      {
        $unset: { unit: "", "name.ru": "" },
        $set: { "name.en": "Duration" },
      },
    )

    const response = await app.inject({
      method: "GET",
      url: `/items/${item._id}`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json<ItemResponseDto>().features).toEqual([
      {
        id: feature._id.toHexString(),
        key: "duration",
        name: { ru: null, en: "Duration" },
        valueType: "number",
        unit: null,
        value: 120,
      },
    ])
  })

  it.each([
    { valueType: EFeatureValueType.NUMBER, value: 0 },
    { valueType: EFeatureValueType.NUMBER, value: 1.5 },
    { valueType: EFeatureValueType.BOOLEAN, value: false },
    { valueType: EFeatureValueType.BOOLEAN, value: true },
    { valueType: EFeatureValueType.STRING, value: "" },
    { valueType: EFeatureValueType.STRING, value: "announced" },
    { valueType: EFeatureValueType.STRING, value: "cancelled" },
  ])(
    "сохраняет значение характеристики $valueType: $value",
    async ({ valueType, value }) => {
      const { app } = getTestApplication()
      const item = await createItem()
      const feature = await createFeature({
        item: item._id,
        key: "feature",
        valueType,
        value,
      })
      const response = await app.inject({
        method: "GET",
        url: `/items/${item._id}`,
      })

      expect(response.statusCode).toBe(200)
      expect(response.json<ItemResponseDto>().features).toEqual([
        {
          id: feature._id.toHexString(),
          key: "feature",
          name: feature.name,
          valueType,
          value,
          unit: null,
        },
      ])
    },
  )

  it("не выдумывает значения неизвестных характеристик и пропускает отсутствующий справочник", async () => {
    const { app, connection } = getTestApplication()
    const item = await createItem()
    await connection.collection("Feature").insertOne({
      key: "duration",
      valueType: "number",
      unit: "minute",
      name: { ru: "Продолжительность", en: null },
    })
    await connection
      .collection("ItemFeature")
      .insertOne({ item: item._id, feature: new Types.ObjectId(), value: 123 })

    const response = await app.inject({
      method: "GET",
      url: `/items/${item._id}`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json<ItemResponseDto>().features).toEqual([])
  })

  it.each(["first", "second"] as const)(
    "возвращает противоположную сторону и её роль, когда открытый Item находится в %s",
    async (side) => {
      const { app } = getTestApplication()
      const item = await createItem()
      const related = await createItem({
        title: { ru: "Продолжение", en: "Sequel" },
        media: [
          { src: "/sequel.webp", language: "en", type: EMediaType.POSTER },
        ],
      })
      const ownRole = await createRole({
        key: "prequel",
        name: { ru: "Предыстория", en: "Prequel" },
      })
      const relatedRole = await createRole({
        key: "sequel",
        name: { ru: "Продолжение", en: "Sequel" },
      })
      const own = {
        item: item._id,
        role: ownRole._id,
        roleNameOverride: { ru: "Не показывать", en: "Wrong side" },
      }
      const opposite = {
        item: related._id,
        role: relatedRole._id,
        roleNameOverride: { ru: "Часть II", en: null },
      }
      await createRelation({
        first: side === "first" ? own : opposite,
        second: side === "first" ? opposite : own,
      })

      const response = await app.inject({
        method: "GET",
        url: `/items/${item._id}`,
      })

      expect(response.statusCode).toBe(200)
      expect(response.json<ItemResponseDto>().relations).toEqual([
        {
          item: {
            id: related._id.toHexString(),
            type: "movie",
            title: related.title,
            media: related.media,
          },
          role: {
            id: relatedRole._id.toHexString(),
            key: "sequel",
            name: { ru: "Часть II", en: "Sequel" },
          },
        },
      ])

      const reverse = await app.inject({
        method: "GET",
        url: `/items/${related._id}`,
      })

      expect(reverse.statusCode).toBe(200)
      expect(reverse.json<ItemResponseDto>().relations).toEqual([
        {
          item: {
            id: item._id.toHexString(),
            type: "movie",
            title: item.title,
            media: [],
          },
          role: {
            id: ownRole._id.toHexString(),
            key: "prequel",
            name: { ru: "Не показывать", en: "Wrong side" },
          },
        },
      ])
    },
  )

  it.each([
    {
      override: undefined,
      standard: { ru: "Продолжение", en: "Sequel" },
      expected: { ru: "Продолжение", en: "Sequel" },
    },
    {
      override: { ru: null, en: null },
      standard: { ru: "Продолжение", en: "Sequel" },
      expected: { ru: "Продолжение", en: "Sequel" },
    },
    {
      override: { ru: null, en: "Part II" },
      standard: { ru: "Продолжение", en: "Sequel" },
      expected: { ru: "Продолжение", en: "Part II" },
    },
    {
      override: { ru: "Часть II", en: "Part II" },
      standard: { ru: "Продолжение", en: "Sequel" },
      expected: { ru: "Часть II", en: "Part II" },
    },
    {
      override: undefined,
      standard: { ru: null, en: "Sequel" },
      expected: { ru: null, en: "Sequel" },
    },
    {
      override: undefined,
      standard: { ru: null, en: null },
      expected: { ru: null, en: null },
    },
  ])(
    "применяет fallback роли отдельно по языкам: $expected",
    async ({ override, standard, expected }) => {
      const { app } = getTestApplication()
      const item = await createItem()
      const related = await createItem()
      const role = await createRole({ key: "sequel", name: standard })
      await createRelation({
        first: { item: item._id, role: role._id },
        second: {
          item: related._id,
          role: role._id,
          ...(override === undefined ? {} : { roleNameOverride: override }),
        },
      })

      const response = await app.inject({
        method: "GET",
        url: `/items/${item._id}`,
      })

      expect(response.statusCode).toBe(200)
      expect(response.json<ItemResponseDto>().relations[0].role.name).toEqual(
        expected,
      )
    },
  )

  it.each(["first", "second"] as const)(
    "пропускает отсутствующий или удалённый связанный Item со стороны %s",
    async (side) => {
      const { app } = getTestApplication()
      const item = await createItem()
      const deleted = await createItem({ deletedAt: new Date() })
      const role = await createRole({
        key: "sequel",
        name: { ru: "Продолжение", en: null },
      })

      for (const relatedId of [new Types.ObjectId(), deleted._id]) {
        const own = { item: item._id, role: role._id }
        const opposite = { item: relatedId, role: role._id }
        await createRelation({
          first: side === "first" ? own : opposite,
          second: side === "first" ? opposite : own,
        })
      }

      const response = await app.inject({
        method: "GET",
        url: `/items/${item._id}`,
      })

      expect(response.statusCode).toBe(200)
      expect(response.json<ItemResponseDto>().relations).toEqual([])
    },
  )

  it("пропускает связь без справочника противоположной роли", async () => {
    const { app } = getTestApplication()
    const item = await createItem()
    const related = await createItem()
    const role = await createRole({
      key: "prequel",
      name: { ru: "Предыстория", en: null },
    })
    await createRelation({
      first: { item: item._id, role: role._id },
      second: { item: related._id, role: new Types.ObjectId() },
    })

    const response = await app.inject({
      method: "GET",
      url: `/items/${item._id}`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json<ItemResponseDto>().relations).toEqual([])
  })

  it("сортирует связи по их ID, не загружает косвенные связи и сохраняет разные связи с одним Item", async () => {
    const { app } = getTestApplication()
    const item = await createItem()
    const first = await createItem({
      title: { ru: "Первый связанный", en: null },
    })
    const second = await createItem({
      title: { ru: "Второй связанный", en: null },
    })
    const indirect = await createItem({ title: { ru: "Косвенный", en: null } })
    const role = await createRole({
      key: "sequel",
      name: { ru: "Продолжение", en: null },
    })
    await createRelation({
      id: new Types.ObjectId("000000000000000000000030"),
      first: { item: item._id, role: role._id },
      second: {
        item: first._id,
        role: role._id,
        roleNameOverride: { ru: "Третья связь", en: null },
      },
    })
    await createRelation({
      id: new Types.ObjectId("000000000000000000000010"),
      first: { item: second._id, role: role._id },
      second: { item: item._id, role: role._id },
    })
    await createRelation({
      id: new Types.ObjectId("000000000000000000000020"),
      first: { item: item._id, role: role._id },
      second: {
        item: first._id,
        role: role._id,
        roleNameOverride: { ru: "Вторая связь", en: null },
      },
    })
    await createRelation({
      first: { item: first._id, role: role._id },
      second: { item: indirect._id, role: role._id },
    })

    const response = await app.inject({
      method: "GET",
      url: `/items/${item._id}`,
    })

    expect(response.statusCode).toBe(200)
    const relations = response.json<ItemResponseDto>().relations
    expect(relations.map((relation) => relation.item.id)).toEqual([
      second._id.toHexString(),
      first._id.toHexString(),
      first._id.toHexString(),
    ])
    expect(relations.map((relation) => relation.role.name.ru)).toEqual([
      "Продолжение",
      "Вторая связь",
      "Третья связь",
    ])
    for (const relation of relations) {
      expect(Object.keys(relation).sort()).toEqual(["item", "role"])
      expect(Object.keys(relation.item).sort()).toEqual([
        "id",
        "media",
        "title",
        "type",
      ])
      expect(Object.keys(relation.role).sort()).toEqual(["id", "key", "name"])
    }
  })

  it("возвращает все прямые связи без скрытого ограничения размера страницы", async () => {
    const { app, connection } = getTestApplication()
    const item = await createItem()
    const role = await createRole({
      key: "related",
      name: { ru: "Связанное", en: null },
    })
    const related = Array.from({ length: 61 }, (_, index) => ({
      _id: new Types.ObjectId(),
      type: "movie",
      title: { ru: `Фильм ${index}`, en: null },
      media: [],
      deletedAt: null,
    }))
    await connection.collection("Item").insertMany(related)
    const relations = related.map((entry) => ({
      _id: new Types.ObjectId(),
      first: { item: item._id, role: role._id },
      second: { item: entry._id, role: role._id },
    }))
    await connection.collection("Relation").insertMany([...relations].reverse())

    const response = await app.inject({
      method: "GET",
      url: `/items/${item._id}`,
    })

    expect(response.statusCode).toBe(200)
    expect(
      response
        .json<ItemResponseDto>()
        .relations.map((relation) => relation.item.id),
    ).toEqual(related.map((entry) => entry._id.toHexString()))
  })

  it("не раскрывает внешние ссылки, статистику, личные данные и коллекции и не изменяет БД", async () => {
    const { app, connection } = getTestApplication()
    const item = await createItem()
    const owner = await createAccount()
    const userId = owner.user._id
    const collectionId = new Types.ObjectId()
    const groupId = new Types.ObjectId()
    await createTag({ item: item._id, key: "drama" })
    await createFeature({
      item: item._id,
      key: "duration",
      valueType: EFeatureValueType.NUMBER,
      value: 120,
      unit: EUnit.MINUTE,
    })
    const related = await createItem()
    const role = await createRole({
      key: "sequel",
      name: { ru: "Продолжение", en: "Sequel" },
    })
    await createRelation({
      first: { item: item._id, role: role._id },
      second: {
        item: related._id,
        role: role._id,
        roleNameOverride: { ru: "Часть II", en: null },
      },
    })
    await connection.collection("Item").updateOne(
      { _id: item._id },
      {
        $set: {
          externalLinks: ["https://private-source.example/item"],
          statistics: { rating: 9 },
        },
      },
    )
    await connection.collection("UserItem").insertOne({
      user: userId,
      item: item._id,
      status: "blocked",
      isFavorite: true,
      rating: 9,
      note: "Приватная заметка",
      attempts: [
        {
          id: new Types.ObjectId(),
          isCompleted: true,
          progress: { value: 100, unit: "percent" },
        },
      ],
    })
    await connection
      .collection("ItemMetric")
      .insertOne({ item: item._id, ratingAverage: 8, ratingCount: 10 })
    await connection.collection("Collection").insertOne({
      _id: collectionId,
      author: null,
      type: "franchise",
      title: { ru: "Франшиза", en: null },
      blocks: [{ id: groupId, type: "group" }],
      deletedAt: null,
    })
    await connection
      .collection("CollectionItem")
      .insertOne({ collectionId, item: item._id, groupId, position: 0 })
    await connection.collection("UserCollection").insertOne({
      user: userId,
      collectionId,
      isHidden: true,
      isFavorite: true,
      rating: 7,
    })
    await connection.collection("SourceItem").insertOne({
      item: item._id,
      externalId: "external-secret",
      url: "https://private-source.example/item",
    })
    const names = [
      "Item",
      "ItemTag",
      "Tag",
      "Feature",
      "ItemFeature",
      "Relation",
      "ItemRelationRole",
      "UserItem",
      "ItemMetric",
      "Collection",
      "CollectionItem",
      "UserCollection",
      "SourceItem",
      "User",
      "Session",
    ]
    const before = await Promise.all(
      names.map(async (name) =>
        connection.collection(name).find().sort({ _id: 1 }).toArray(),
      ),
    )

    const first = await app.inject({ method: "GET", url: `/items/${item._id}` })
    const second = await app.inject({
      method: "GET",
      url: `/items/${item._id}`,
      headers: {
        cookie: "__Host-accessToken=invalid; __Host-refreshToken=invalid",
      },
    })
    const authenticated = await app.inject({
      method: "GET",
      url: `/items/${item._id}`,
      headers: owner.headers,
    })

    expect(first.statusCode).toBe(200)
    expect(second.statusCode).toBe(200)
    expect(authenticated.statusCode).toBe(200)
    expect(authenticated.headers["set-cookie"]).toBeUndefined()
    expect(second.json()).toEqual(first.json())
    expect(authenticated.json()).toEqual(first.json())
    expect(Object.keys(first.json()).sort()).toEqual([
      "aliases",
      "description",
      "features",
      "id",
      "media",
      "relations",
      "tags",
      "title",
      "type",
    ])
    expect(Object.keys(first.json<ItemResponseDto>().tags[0]).sort()).toEqual([
      "group",
      "id",
      "key",
      "name",
    ])
    expect(
      Object.keys(first.json<ItemResponseDto>().features[0]).sort(),
    ).toEqual(["id", "key", "name", "unit", "value", "valueType"])
    for (const secret of [
      "Приватная заметка",
      "private-source",
      "external-secret",
      "Франшиза",
      "Описание тега",
      "Описание характеристики",
    ]) {
      expect(first.body).not.toContain(secret)
    }
    const after = await Promise.all(
      names.map(async (name) =>
        connection.collection(name).find().sort({ _id: 1 }).toArray(),
      ),
    )
    expect(after).toEqual(before)
  })

  it("читает актуальные данные и перестаёт возвращать Item после мягкого удаления", async () => {
    const { app, connection } = getTestApplication()
    const item = await createItem()
    const before = await app.inject({
      method: "GET",
      url: `/items/${item._id}`,
    })
    expect(before.statusCode).toBe(200)
    expect(before.json<ItemResponseDto>().title).toEqual({
      ru: "Фильм",
      en: null,
    })

    await connection
      .collection("Item")
      .updateOne(
        { _id: item._id },
        { $set: { "title.ru": "Обновлённый фильм" } },
      )
    const updated = await app.inject({
      method: "GET",
      url: `/items/${item._id}`,
    })
    expect(updated.statusCode).toBe(200)
    expect(updated.json<ItemResponseDto>().title).toEqual({
      ru: "Обновлённый фильм",
      en: null,
    })

    await connection
      .collection("Item")
      .updateOne({ _id: item._id }, { $set: { deletedAt: new Date() } })
    const deleted = await app.inject({
      method: "GET",
      url: `/items/${item._id}`,
    })
    expect(deleted.statusCode).toBe(404)
  })

  it("сохраняет CORS и доступность безопасного GET с другого origin", async () => {
    const { app } = getTestApplication()
    const item = await createItem()
    const response = await app.inject({
      method: "GET",
      url: `/items/${item._id}`,
      headers: { origin: "http://localhost", "sec-fetch-site": "cross-site" },
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost",
    )
    expect(response.headers["access-control-allow-credentials"]).toBe("true")
    const preflight = await app.inject({
      method: "OPTIONS",
      url: `/items/${item._id}`,
      headers: {
        origin: "http://localhost",
        "access-control-request-method": "GET",
      },
    })
    expect(preflight.statusCode).toBe(204)
    expect(preflight.headers["access-control-allow-methods"]).toContain("GET")
  })

  it("применяет общий throttling к публичному чтению", async () => {
    const { app } = getTestApplication()
    const item = await createItem()

    for (let request = 0; request < 100; request += 1) {
      const response = await app.inject({
        method: "GET",
        url: `/items/${item._id}`,
      })
      expect(response.statusCode).toBe(200)
    }

    const limited = await app.inject({
      method: "GET",
      url: `/items/${item._id}`,
    })

    expect(limited.statusCode).toBe(429)
    expect(limited.json()).toMatchObject({
      error: { code: "TOO_MANY_REQUESTS" },
    })
    expect(limited.headers["retry-after"]).toBeDefined()
  })

  it("включает гостевой GET /items/:id и вложенный DTO в OpenAPI реального тестового приложения", () => {
    const { app } = getTestApplication()
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setOpenAPIVersion("3.2.0").build(),
    )

    expect(document.paths["/items/{id}"].get).toMatchObject({
      operationId: "ItemController_getById",
      responses: {
        "200": {
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ItemResponseDto" },
            },
          },
        },
      },
    })
    expect(document.paths["/items/{id}"].get?.security).toBeUndefined()
    expect(document.components?.schemas).toHaveProperty(
      "ItemRelationResponseDto.properties.role.allOf.0.$ref",
      "#/components/schemas/ItemRelationRoleResponseDto",
    )
    expect(document.components?.schemas).toHaveProperty(
      "ItemResponseDto.properties.title.$ref",
      "#/components/schemas/LanguageTextResponseDto",
    )
  })
})
