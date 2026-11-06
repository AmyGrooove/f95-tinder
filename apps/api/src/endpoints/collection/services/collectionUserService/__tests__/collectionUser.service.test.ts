import { describe, expect, it, jest } from "@jest/globals"
import { ConflictException, NotFoundException } from "@nestjs/common"
import { Types } from "mongoose"

import type { CollectionAuthService } from "@endpoints/collection/services/collectionAuthService"
import type { CollectionRepository } from "@entities/collection/services/collectionRepository"
import type { UserCollectionRepository } from "@entities/userCollection/services/userCollectionRepository"

import { CollectionUserService } from "../core/collectionUser.service"

describe("CollectionUserService", () => {
  const userId = new Types.ObjectId()
  const id = new Types.ObjectId()

  const setup = () => {
    const auth = { authenticate: jest.fn(async () => userId) }
    const collections = {
      checkIsNotDeleted: jest.fn(async () => true),
      findNotDeletedAuthorById: jest
        .fn<() => Promise<{ author: Types.ObjectId } | null>>()
        .mockResolvedValue({ author: new Types.ObjectId() }),
    }
    const reactions = {
      findByUserAndCollection:
        jest.fn<UserCollectionRepository["findByUserAndCollection"]>(),
      upsertReaction: jest.fn<UserCollectionRepository["upsertReaction"]>(),
    }
    const service = new CollectionUserService(
      auth as unknown as CollectionAuthService,
      collections as unknown as CollectionRepository,
      reactions as unknown as UserCollectionRepository,
    )
    return { collections, reactions, service }
  }

  it("возвращает значения по умолчанию для доступной подборки без реакции", async () => {
    const { reactions, service } = setup()
    reactions.findByUserAndCollection.mockResolvedValueOnce(null)

    await expect(service.getUser("token", id)).resolves.toEqual({
      isFavorite: false,
      isHidden: false,
      rating: null,
    })
    expect(reactions.findByUserAndCollection).toHaveBeenCalledWith(userId, id)
  })

  it("не читает реакцию для недоступной подборки", async () => {
    const { collections, reactions, service } = setup()
    collections.checkIsNotDeleted.mockResolvedValueOnce(false)

    await expect(service.getUser("token", id)).rejects.toThrow(
      NotFoundException,
    )
    expect(reactions.findByUserAndCollection).not.toHaveBeenCalled()
  })

  it("запрещает выставлять оценку своей подборке до сохранения реакции", async () => {
    const { collections, reactions, service } = setup()
    collections.findNotDeletedAuthorById.mockResolvedValueOnce({
      author: new Types.ObjectId(userId),
    })

    await expect(
      service.updateReaction("token", { id, reaction: { rating: 5 } }),
    ).rejects.toThrow(ConflictException)
    expect(reactions.upsertReaction).not.toHaveBeenCalled()
  })

  it("возвращает 404, если подборка стала недоступна между чтением и сохранением", async () => {
    const { reactions, service } = setup()
    const reaction = { isFavorite: true }
    reactions.upsertReaction.mockResolvedValueOnce(null)

    await expect(
      service.updateReaction("token", { id, reaction }),
    ).rejects.toThrow(NotFoundException)
    expect(reactions.upsertReaction).toHaveBeenCalledWith({
      userId,
      collectionId: id,
      reaction,
    })
  })
})
