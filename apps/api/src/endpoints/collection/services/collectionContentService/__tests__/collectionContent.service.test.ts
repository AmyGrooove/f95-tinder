import { describe, expect, it, jest } from "@jest/globals"
import { BadRequestException, NotFoundException } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import { Types } from "mongoose"
import { CollectionRepository } from "@entities/collection/services/collectionRepository"
import { ItemCollectionRepository } from "@entities/itemCollection/services/itemCollectionRepository"
import { CollectionContentService } from "../core/collectionContent.service"

describe("CollectionContentService", () => {
  const createService = async () => {
    const findNotDeletedById = jest.fn()
    const readContentSlice = jest.fn()
    const moduleRef = await Test.createTestingModule({
      providers: [
        CollectionContentService,
        { provide: CollectionRepository, useValue: { findNotDeletedById } },
        { provide: ItemCollectionRepository, useValue: { readContentSlice } },
      ],
    }).compile()
    return {
      service: moduleRef.get(CollectionContentService),
      findNotDeletedById,
      readContentSlice,
    }
  }

  it("запрашивает один дополнительный элемент и возвращает текст пустой подборки", async () => {
    const { service, findNotDeletedById, readContentSlice } =
      await createService()
    const id = new Types.ObjectId()
    findNotDeletedById.mockReturnValue({
      version: 0,
      blocks: [{ type: "text", content: { ru: "Вступление" } }],
    })
    readContentSlice.mockReturnValue([])
    await expect(service.getItems({ id, query: {} })).resolves.toEqual({
      nextCursor: null,
      blocks: [{ type: "text", content: { ru: "Вступление", en: null } }],
    })
    expect(readContentSlice).toHaveBeenCalledWith({
      collectionId: id,
      groupIds: [],
      after: undefined,
      limit: 51,
    })
  })

  it("отклоняет чужой курсор и отсутствующую подборку до чтения состава", async () => {
    const { service, findNotDeletedById, readContentSlice } =
      await createService()
    const id = new Types.ObjectId()
    findNotDeletedById
      .mockReturnValueOnce(null)
      .mockReturnValueOnce({ version: 0, blocks: [] })
    await expect(service.getItems({ id, query: {} })).rejects.toBeInstanceOf(
      NotFoundException,
    )
    await expect(
      service.getItems({ id, query: { cursor: "YWJj" } }),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(readContentSlice).not.toHaveBeenCalled()
  })
})
