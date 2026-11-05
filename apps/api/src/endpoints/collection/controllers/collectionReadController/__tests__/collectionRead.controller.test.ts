import { describe, expect, it, jest } from "@jest/globals"
import { BadRequestException, NotFoundException } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import { Types } from "mongoose"
import { CollectionContentService } from "@endpoints/collection/services/collectionContentService"
import { CollectionService } from "@endpoints/collection/services/collectionService"
import { CollectionReadController } from "../core/collectionRead.controller"

describe("CollectionReadController", () => {
  const createController = async () => {
    const getById = jest.fn<CollectionService["getById"]>()
    const getItems = jest.fn<CollectionContentService["getItems"]>()
    const moduleRef = await Test.createTestingModule({
      controllers: [CollectionReadController],
      providers: [
        { provide: CollectionService, useValue: { getById } },
        { provide: CollectionContentService, useValue: { getItems } },
      ],
    }).compile()
    return {
      controller: moduleRef.get(CollectionReadController),
      getById,
      getItems,
    }
  }

  it("передаёт курсор и размер порции сервису и возвращает блоки", async () => {
    const { controller, getItems } = await createController()
    const id = new Types.ObjectId()
    const query = { cursor: "YWJj", limit: 10 as const }
    const result = { nextCursor: false as const, blocks: [] }
    getItems.mockResolvedValue(result)
    await expect(controller.getItems(id, query)).resolves.toEqual(result)
    expect(getItems).toHaveBeenCalledWith({ id, query })
  })

  it("сохраняет 404 чтения метаданных и 400 неверного курсора", async () => {
    const { controller, getById, getItems } = await createController()
    const id = new Types.ObjectId()
    const notFound = new NotFoundException()
    const invalidCursor = new BadRequestException()
    getById.mockRejectedValue(notFound)
    getItems.mockRejectedValue(invalidCursor)
    await expect(controller.getById(id)).rejects.toBe(notFound)
    expect(getById).toHaveBeenCalledWith(id)
    await expect(controller.getItems(id, { cursor: "bad" })).rejects.toBe(
      invalidCursor,
    )
  })
})
