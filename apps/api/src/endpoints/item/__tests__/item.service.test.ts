import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals"
import { NotFoundException } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import type { TestingModule } from "@nestjs/testing"
import { Types } from "mongoose"

import { EFeatureValueType } from "@entities/feature/schemas/EFeatureValueType"
import { EItemType } from "@entities/item/schemas/EItemType"
import { ItemRepository } from "@entities/item/services/item.repository"
import type { IItemDetails } from "@entities/item/types/IItemDetails"
import { EMediaType } from "@entities/shared/schemas/EMediaType"
import { EUnit } from "@entities/shared/schemas/EUnit"
import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { ETagGroup } from "@entities/tag/schemas/ETagGroup"

import { ItemService } from "../services/item.service"

describe("ItemService", () => {
  const repository = {
    findDetailsById: jest.fn<ItemRepository["findDetailsById"]>(),
  }
  let moduleRef: TestingModule
  let service: ItemService
  let item: IItemDetails

  beforeEach(async () => {
    repository.findDetailsById.mockReset()
    moduleRef = await Test.createTestingModule({
      providers: [
        ItemService,
        { provide: ItemRepository, useValue: repository },
      ],
    }).compile()
    service = moduleRef.get(ItemService)
    item = {
      _id: new Types.ObjectId(),
      type: EItemType.MOVIE,
      title: { ru: "Фильм", en: null },
      description: { ru: null, en: "Description" },
      aliases: [],
      media: [],
      tags: [],
      features: [],
      relations: [],
    }
    repository.findDetailsById.mockResolvedValue(item)
  })

  afterEach(async () => moduleRef?.close())

  it("возвращает согласованные поля и пустые блоки без выдуманных характеристик", async () => {
    await expect(service.getById(item._id)).resolves.toEqual({
      id: item._id.toHexString(),
      type: "movie",
      title: { ru: "Фильм", en: null },
      description: { ru: null, en: "Description" },
      aliases: [],
      media: [],
      tags: [],
      features: [],
      relations: [],
    })
    expect(repository.findDetailsById).toHaveBeenCalledTimes(1)
    expect(repository.findDetailsById).toHaveBeenCalledWith(item._id)
  })

  it("не раскрывает поля хранения и лишние вложенные данные", async () => {
    const tagId = new Types.ObjectId()
    const source = {
      ...item,
      createdAt: new Date(),
      deletedAt: null,
      user: { note: "Приватная заметка" },
      statistics: { rating: 9 },
      externalLinks: ["https://source.example/item"],
      media: [
        {
          src: "/poster.webp",
          language: null,
          type: EMediaType.POSTER,
          secret: "internal",
        },
      ],
      tags: [
        {
          _id: tagId,
          key: "drama",
          group: ETagGroup.GENRE,
          name: { ru: "Драма", en: null, secret: "internal" },
          relevanceScore: 1,
          description: "internal",
          aliases: ["internal"],
          embedding: [1],
        },
      ],
    }
    repository.findDetailsById.mockResolvedValue(source)

    const result = await service.getById(item._id)

    expect(Object.keys(result).sort()).toEqual([
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
    expect(result.media).toEqual([
      { src: "/poster.webp", language: null, type: "poster" },
    ])
    expect(result.tags).toEqual([
      {
        id: tagId.toHexString(),
        key: "drama",
        group: "genre",
        name: { ru: "Драма", en: null },
      },
    ])
    expect(JSON.stringify(result)).not.toContain("internal")
    expect(JSON.stringify(result)).not.toContain("Приватная заметка")
  })

  it("сохраняет порядок альтернативных названий и медиа всех типов", async () => {
    item.aliases = ["Second", "First"]
    item.media = [
      { src: "/frame.webp", language: null, type: EMediaType.SCREENSHOT },
      { src: "/trailer.mp4", language: "en", type: EMediaType.TRAILER },
      { src: "/poster.webp", language: "ru", type: EMediaType.POSTER },
    ]

    const result = await service.getById(item._id)

    expect(result.aliases).toEqual(["Second", "First"])
    expect(result.media).toEqual(item.media)
  })

  it.each([
    {
      valueType: EFeatureValueType.NUMBER,
      value: 120,
      unit: EUnit.MINUTE,
      expected: 120,
    },
    { valueType: EFeatureValueType.NUMBER, value: 0, unit: null, expected: 0 },
    {
      valueType: EFeatureValueType.NUMBER,
      value: 1.5,
      unit: null,
      expected: 1.5,
    },
    {
      valueType: EFeatureValueType.BOOLEAN,
      value: false,
      unit: null,
      expected: false,
    },
    {
      valueType: EFeatureValueType.BOOLEAN,
      value: true,
      unit: null,
      expected: true,
    },
    {
      valueType: EFeatureValueType.STRING,
      value: "16+",
      unit: null,
      expected: "16+",
    },
    {
      valueType: EFeatureValueType.STRING,
      value: "",
      unit: null,
      expected: "",
    },
    {
      valueType: EFeatureValueType.DATE,
      value: new Date("2026-10-25T12:30:00+03:00"),
      unit: null,
      expected: "2026-10-25T09:30:00.000Z",
    },
  ])(
    "сериализует характеристику $valueType со значением $expected без потери значения",
    async ({ valueType, value, unit, expected }) => {
      const featureId = new Types.ObjectId()
      item.features = [
        {
          _id: featureId,
          key: "feature",
          name: { ru: null, en: "Feature" },
          valueType,
          unit,
          value,
        },
      ]

      const result = await service.getById(item._id)

      expect(result.features).toEqual([
        {
          id: featureId.toHexString(),
          key: "feature",
          name: { ru: null, en: "Feature" },
          valueType,
          unit,
          value: expected,
        },
      ])
    },
  )

  it.each([
    {
      override: { ru: null, en: null },
      standard: { ru: "Продолжение", en: "Sequel" },
      expected: { ru: "Продолжение", en: "Sequel" },
    },
    {
      override: { ru: "Часть II", en: null },
      standard: { ru: "Продолжение", en: "Sequel" },
      expected: { ru: "Часть II", en: "Sequel" },
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
      override: { ru: null, en: null },
      standard: { ru: null, en: "Sequel" },
      expected: { ru: null, en: "Sequel" },
    },
    {
      override: { ru: null, en: null },
      standard: { ru: null, en: null },
      expected: { ru: null, en: null },
    },
  ])(
    "подставляет название роли отдельно для каждого языка: $expected",
    async ({ override, standard, expected }) => {
      const relatedItemId = new Types.ObjectId()
      const roleId = new Types.ObjectId()
      item.relations = [
        {
          item: {
            _id: relatedItemId,
            type: EItemType.MOVIE,
            title: { ru: null, en: "Related" },
            media: [],
          },
          role: { _id: roleId, key: "sequel", name: standard },
          roleNameOverride: override,
        },
      ]

      const result = await service.getById(item._id)

      expect(result.relations).toEqual([
        {
          item: {
            id: relatedItemId.toHexString(),
            type: "movie",
            title: { ru: null, en: "Related" },
            media: [],
          },
          role: { id: roleId.toHexString(), key: "sequel", name: expected },
        },
      ])
    },
  )

  it("не изменяет полученные из репозитория данные при применении override", async () => {
    item.relations = [
      {
        item: {
          _id: new Types.ObjectId(),
          type: EItemType.MOVIE,
          title: { ru: "Связанный", en: null },
          media: [],
        },
        role: {
          _id: new Types.ObjectId(),
          key: "sequel",
          name: { ru: "Продолжение", en: "Sequel" },
        },
        roleNameOverride: { ru: "Вторая часть", en: null },
      },
    ]
    const before = JSON.stringify(item)

    await service.getById(item._id)

    expect(JSON.stringify(item)).toBe(before)
  })

  it("возвращает 404 при отсутствии доступного произведения", async () => {
    repository.findDetailsById.mockResolvedValue(null)

    await expect(service.getById(item._id)).rejects.toBeInstanceOf(
      NotFoundException,
    )
    await expect(service.getById(item._id)).rejects.toMatchObject({
      message: DICTIONARY.item.notFound,
    })
  })

  it("сохраняет ошибку репозитория вместо подмены пустым ответом или 404", async () => {
    const error = new Error("MongoDB unavailable")
    repository.findDetailsById.mockRejectedValue(error)

    await expect(service.getById(item._id)).rejects.toBe(error)
  })
})
