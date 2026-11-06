import { describe, expect, it, jest } from "@jest/globals"
import { BadRequestException, NotFoundException } from "@nestjs/common"
import { Types } from "mongoose"

import type { StorageService } from "@infrastructure/storage/services/storageService"
import type { UserRepository } from "@entities/user/services/userRepository"
import type { MongoTransactionService } from "@infrastructure/database/services/mongoTransactionService"
import type { CollectionAuthService } from "@endpoints/collection/services/collectionAuthService"
import type { ItemRepository } from "@entities/item/services/itemRepository"
import type { ItemCollectionRepository } from "@entities/itemCollection/services/itemCollectionRepository"
import type { CollectionRepository } from "@entities/collection/services/collectionRepository"
import { DICTIONARY } from "@entities/shared/static/DICTIONARY"

import { CollectionService } from "../core/collection.service"

describe("CollectionService", () => {
  const id = new Types.ObjectId()
  const userId = new Types.ObjectId()

  const setup = () => {
    const collections = {
      findNotDeletedById: jest
        .fn<(id: Types.ObjectId) => Promise<null>>()
        .mockResolvedValue(null),
    }
    const auth = { authenticate: jest.fn(async () => userId) }
    const transactions = { run: jest.fn() }
    const service = new CollectionService(
      collections as unknown as CollectionRepository,
      {} as ItemCollectionRepository,
      {} as ItemRepository,
      auth as unknown as CollectionAuthService,
      transactions as unknown as MongoTransactionService,
      {} as UserRepository,
      {} as StorageService,
    )
    return { collections, transactions, service }
  }

  it("возвращает 404 для отсутствующей или удалённой подборки", async () => {
    const { collections, service } = setup()

    await expect(service.getById(id)).rejects.toThrow(NotFoundException)
    expect(collections.findNotDeletedById).toHaveBeenCalledWith(id)
  })

  it("отклоняет создание без названия до открытия транзакции", async () => {
    const { transactions, service } = setup()

    await expect(
      service.create("token", { title: { ru: null, en: null } }),
    ).rejects.toThrow(
      new BadRequestException(DICTIONARY.collection.titleRequired),
    )
    expect(transactions.run).not.toHaveBeenCalled()
  })

  it("отклоняет создание со ссылкой на отсутствующую группу до открытия транзакции", async () => {
    const { transactions, service } = setup()

    await expect(
      service.create("token", {
        title: { ru: "Подборка", en: null },
        items: [
          {
            itemId: id.toHexString(),
            groupId: new Types.ObjectId().toHexString(),
            position: 0,
          },
        ],
      }),
    ).rejects.toThrow(
      new BadRequestException(DICTIONARY.collection.invalidGroup),
    )
    expect(transactions.run).not.toHaveBeenCalled()
  })
})
