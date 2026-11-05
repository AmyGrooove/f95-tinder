import { describe, expect, it, jest } from "@jest/globals"
import { BadRequestException, NotFoundException } from "@nestjs/common"
import { Types } from "mongoose"
import { Test } from "@nestjs/testing"
import { CollectionUserService } from "@endpoints/collection/services/collectionUserService"
import { CollectionUserController } from "../core/collectionUser.controller"

describe("CollectionUserController", () => {
  const createController = async () => {
    const service = {
      getUser: jest.fn<CollectionUserService["getUser"]>(),
      updateReaction: jest.fn<CollectionUserService["updateReaction"]>(),
    }
    const moduleRef = await Test.createTestingModule({
      controllers: [CollectionUserController],
      providers: [{ provide: CollectionUserService, useValue: service }],
    }).compile()
    return { controller: moduleRef.get(CollectionUserController), service }
  }

  it("возвращает личную реакцию и передаёт cookie и ID сервису", async () => {
    const { controller, service } = await createController()
    const id = new Types.ObjectId()
    const reaction = { isFavorite: true, rating: null, isHidden: false }
    service.getUser.mockResolvedValue(reaction)
    await expect(controller.getUser("token", id)).resolves.toEqual(reaction)
    expect(service.getUser).toHaveBeenCalledWith("token", id)
  })

  it.each([
    { isFavorite: true },
    { rating: 1 },
    { rating: null },
    { isHidden: false, rating: 10 },
  ])(
    "передаёт только указанные поля %j и завершает без тела",
    async (reaction) => {
      const { controller, service } = await createController()
      const id = new Types.ObjectId()
      await expect(
        controller.updateReaction("token", id, reaction),
      ).resolves.toBeUndefined()
      expect(service.updateReaction).toHaveBeenCalledWith("token", {
        id,
        reaction,
      })
    },
  )

  it("отклоняет пустое изменение до обращения к сервису", async () => {
    const { controller, service } = await createController()
    await expect(
      controller.updateReaction("token", new Types.ObjectId(), {}),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(service.updateReaction).not.toHaveBeenCalled()
  })

  it("сохраняет ошибки сервиса при чтении и изменении", async () => {
    const { controller, service } = await createController()
    const error = new NotFoundException()
    service.getUser.mockRejectedValue(error)
    service.updateReaction.mockRejectedValue(error)
    const id = new Types.ObjectId()
    await expect(controller.getUser(undefined, id)).rejects.toBe(error)
    await expect(
      controller.updateReaction(undefined, id, { isHidden: true }),
    ).rejects.toBe(error)
    expect(service.getUser).toHaveBeenCalledWith(undefined, id)
  })
})
