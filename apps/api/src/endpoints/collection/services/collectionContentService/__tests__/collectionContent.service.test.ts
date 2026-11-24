import { describe, expect, it, jest } from "@jest/globals"
import { BadRequestException, NotFoundException } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import { Types } from "mongoose"
import { CollectionRepository } from "@entities/collection/services/collectionRepository"
import { ItemCollectionRepository } from "@entities/itemCollection/services/itemCollectionRepository"
import { UserCollectionRepository } from "@entities/userCollection/services/userCollectionRepository"
import { CollectionAuthService } from "@endpoints/collection/services/collectionAuthService"
import { CursorService } from "@infrastructure/cache/services/cursorService"
import { StorageService } from "@infrastructure/storage/services/storageService"
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
        { provide: UserCollectionRepository, useValue: {} },
        { provide: CollectionAuthService, useValue: {} },
        { provide: StorageService, useValue: {} },
        CursorService,
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
      isHidden: false,
    })
    expect(readContentSlice).toHaveBeenCalledWith({
      collectionId: id,
      groupIds: [],
      isGrouped: true,
      after: undefined,
      limit: 51,
      rating: undefined,
      search: undefined,
      sort: undefined,
      types: undefined,
      userId: undefined,
      isPersonalFilterApplied: false,
    })
  })

  it("отклоняет некорректный курсор и отсутствующую подборку до чтения состава", async () => {
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
