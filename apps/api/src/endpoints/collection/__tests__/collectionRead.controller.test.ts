import { describe, expect, it, jest } from "@jest/globals"
import { BadRequestException, NotFoundException } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import { Types } from "mongoose"

import { ECollectionType } from "@entities/collection/schemas/ECollectionType"

import { CollectionReadController } from "../controllers/collectionRead.controller"
import { CollectionService } from "../services/collection.service"
import { CollectionContentService } from "../services/collectionContent.service"
import { ECollectionMode } from "../types/ECollectionMode"

describe("CollectionReadController", () => {
  const createController = async () => {
    const service = { getById: jest.fn<CollectionService["getById"]>() }
    const content = {
      getItems: jest.fn<CollectionContentService["getItems"]>(),
      getFilters: jest.fn<CollectionContentService["getFilters"]>(),
    }
    const moduleRef = await Test.createTestingModule({
      controllers: [CollectionReadController],
      providers: [
        { provide: CollectionService, useValue: service },
        { provide: CollectionContentService, useValue: content },
      ],
    }).compile()

    return {
      controller: moduleRef.get(CollectionReadController),
      service,
      content,
      id: new Types.ObjectId(),
    }
  }

  it("читает публичные метаданные по ObjectId и возвращает результат сервиса", async () => {
    const { controller, service, id } = await createController()
    const result = {
      id: id.toHexString(),
      version: 0,
      authorId: null,
      type: ECollectionType.CUSTOM,
      title: { ru: "Тест", en: null },
      description: { ru: null, en: null },
      blocks: [],
      media: [],
      createdAt: "2026-10-23T00:00:00.000Z",
      updatedAt: "2026-10-23T00:00:00.000Z",
    }
    service.getById.mockResolvedValue(result)
    await expect(controller.getById(id)).resolves.toBe(result)
    expect(service.getById).toHaveBeenCalledTimes(1)
    expect(service.getById).toHaveBeenCalledWith(id)
  })

  it("передаёт id и публичные фильтры для страницы произведений", async () => {
    const { controller, content, id } = await createController()
    const query = { page: 2, limit: 1, ratingMin: 7.5, ratingMax: 9 }
    const result = {
      items: [],
      page: 2,
      limit: 1,
      total: 0,
      pages: 0,
      isNextPage: false,
      isPreviousPage: true,
      mode: ECollectionMode.FLAT,
      displayBlocks: [],
    }
    content.getItems.mockResolvedValue(result)
    await expect(controller.getItems(id, query)).resolves.toBe(result)
    expect(content.getItems).toHaveBeenCalledTimes(1)
    expect(content.getItems).toHaveBeenCalledWith({ id, query })
  })

  it("передаёт область группы и возвращает доступные фильтры", async () => {
    const { controller, content, id } = await createController()
    const query = { groupId: new Types.ObjectId().toHexString() }
    const result = {
      tags: [],
      features: [],
      sorting: { availableModes: [ECollectionMode.FLAT] },
    }
    content.getFilters.mockResolvedValue(result)
    await expect(controller.getFilters(id, query)).resolves.toBe(result)
    expect(content.getFilters).toHaveBeenCalledTimes(1)
    expect(content.getFilters).toHaveBeenCalledWith(id, query)
  })

  it("сохраняет ошибку отсутствующей подборки", async () => {
    const { controller, service, id } = await createController()
    const error = new NotFoundException()
    service.getById.mockRejectedValue(error)
    await expect(controller.getById(id)).rejects.toBe(error)
  })

  it("сохраняет ошибку некорректного диапазона общей оценки", async () => {
    const { controller, content, id } = await createController()
    const error = new BadRequestException()
    content.getItems.mockRejectedValue(error)
    await expect(
      controller.getItems(id, { ratingMin: 9, ratingMax: 2 }),
    ).rejects.toBe(error)
  })

  it("сохраняет ошибку некорректной группы фильтров", async () => {
    const { controller, content, id } = await createController()
    const error = new BadRequestException()
    content.getFilters.mockRejectedValue(error)
    await expect(controller.getFilters(id, {})).rejects.toBe(error)
  })
})
