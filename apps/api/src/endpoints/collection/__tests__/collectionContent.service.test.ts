import { describe, expect, it, jest } from "@jest/globals"
import { BadRequestException } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import { Types } from "mongoose"

import { ECollectionBlockType } from "@entities/collection/schemas/ECollectionBlockType"
import { ECollectionType } from "@entities/collection/schemas/ECollectionType"
import { CollectionRepository } from "@entities/collection/services/collection.repository"
import { CollectionItemRepository } from "@entities/collectionItem/services/collectionItem.repository"
import { EItemType } from "@entities/item/schemas/EItemType"

import { CollectionContentService } from "../services/collectionContent.service"
import { ECollectionSort } from "../types/ECollectionSort"

describe("CollectionContentService", () => {
  const createService = async (type = ECollectionType.CUSTOM) => {
    const id = new Types.ObjectId()
    const groupId = new Types.ObjectId()
    const textId = new Types.ObjectId()
    const itemId = new Types.ObjectId()
    const collection = {
      findNotDeletedById: jest.fn(async () => ({
        type,
        blocks: [
          {
            id: textId,
            type: ECollectionBlockType.TEXT,
            content: { ru: "Текст", en: null },
          },
          {
            id: groupId,
            type: ECollectionBlockType.GROUP,
            title: { ru: null, en: null },
            description: { ru: null, en: null },
          },
        ],
      })),
    }
    const items = {
      countAvailableItemsByGroup: jest.fn(async () => [{ groupId, total: 1 }]),
      readContentPage: jest.fn<CollectionItemRepository["readContentPage"]>(),
    }
    items.readContentPage.mockResolvedValue({
      items: [
        {
          item: {
            _id: itemId,
            type: EItemType.MOVIE,
            title: { ru: "Фильм", en: null },
            media: [],
          },
          groupId,
          position: 0,
          note: "Заметка включения",
        },
      ],
      total: 1,
    })
    const moduleRef = await Test.createTestingModule({
      providers: [
        CollectionContentService,
        { provide: CollectionRepository, useValue: collection },
        { provide: CollectionItemRepository, useValue: items },
      ],
    }).compile()

    return {
      service: moduleRef.get(CollectionContentService),
      collection,
      items,
      id,
      groupId,
      itemId,
      textId,
    }
  }

  it("читает публичную страницу без зависимостей авторизации и возвращает только публичные поля", async () => {
    const { service, id, groupId, itemId } = await createService()
    const response = await service.getItems({ id, query: { mode: undefined } })
    expect(response.items).toEqual([
      {
        id: itemId.toHexString(),
        type: "movie",
        title: { ru: "Фильм", en: null },
        media: [],
        membership: {
          groupId: groupId.toHexString(),
          position: 0,
          note: "Заметка включения",
        },
      },
    ])
    expect(response.total).toBe(1)
    expect(response.displayBlocks.map((block) => block.type)).toEqual([
      "text",
      "group",
    ])
  })

  it.each([
    { ratingMin: 1 },
    { ratingMax: 10 },
    { ratingMin: 7.5, ratingMax: 7.5 },
  ])(
    "применяет диапазон общей оценки %j и скрывает текстовые вставки",
    async (query) => {
      const { service, items, id } = await createService()
      const response = await service.getItems({ id, query })
      expect(items.readContentPage).toHaveBeenCalledWith(
        expect.objectContaining(query),
      )
      expect(response.displayBlocks.map((block) => block.type)).toEqual([
        "group",
      ])
      expect(response.total).toBe(1)
    },
  )

  it("отклоняет перевёрнутый диапазон до чтения подборки", async () => {
    const { service, collection, items, id } = await createService()
    await expect(
      service.getItems({ id, query: { ratingMin: 8.5, ratingMax: 8.4 } }),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(collection.findNotDeletedById).not.toHaveBeenCalled()
    expect(items.readContentPage).not.toHaveBeenCalled()
  })

  it.each([
    { direction: undefined, expected: -1 },
    { direction: "desc" as const, expected: -1 },
    { direction: "asc" as const, expected: 1 },
  ])(
    "передаёт направление $direction сортировки по значимости тега",
    async ({ direction, expected }) => {
      const { service, items, id } = await createService(ECollectionType.TAG)

      await service.getItems({
        id,
        query: { sort: ECollectionSort.RELEVANCE_SCORE, direction },
      })

      expect(items.readContentPage).toHaveBeenCalledWith(
        expect.objectContaining({
          sort: "relevanceScore",
          direction: expected,
        }),
      )
    },
  )

  it.each([
    ECollectionType.CUSTOM,
    ECollectionType.FRANCHISE,
    ECollectionType.FEATURE,
  ])(
    "отклоняет сортировку по значимости для типа %s до чтения состава",
    async (type) => {
      const { service, items, id } = await createService(type)

      await expect(
        service.getItems({
          id,
          query: { sort: ECollectionSort.RELEVANCE_SCORE },
        }),
      ).rejects.toBeInstanceOf(BadRequestException)
      expect(items.countAvailableItemsByGroup).not.toHaveBeenCalled()
      expect(items.readContentPage).not.toHaveBeenCalled()
    },
  )

  it.each([ECollectionSort.COLLECTION, ECollectionSort.TITLE])(
    "сохраняет прямое направление по умолчанию для сортировки %s",
    async (sort) => {
      const { service, items, id } = await createService()

      await service.getItems({ id, query: { sort } })

      expect(items.readContentPage).toHaveBeenCalledWith(
        expect.objectContaining({ sort, direction: 1 }),
      )
    },
  )
})
