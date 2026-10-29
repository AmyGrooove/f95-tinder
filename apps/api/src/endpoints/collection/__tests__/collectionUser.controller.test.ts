import { afterEach, describe, expect, it, jest } from "@jest/globals"
import { ConflictException, UnauthorizedException } from "@nestjs/common"
import { Test, type TestingModule } from "@nestjs/testing"
import { Types } from "mongoose"

import { CollectionUserController } from "../controllers/collectionUser.controller"
import { CollectionUserService } from "../services/collectionUser.service"

describe("CollectionUserController", () => {
  let moduleRef: TestingModule | undefined

  afterEach(async () => {
    await moduleRef?.close()
    moduleRef = undefined
  })

  const createController = async () => {
    const service = {
      getUser: jest.fn<CollectionUserService["getUser"]>(),
      updateReaction: jest.fn<CollectionUserService["updateReaction"]>(),
    }
    moduleRef = await Test.createTestingModule({
      controllers: [CollectionUserController],
      providers: [{ provide: CollectionUserService, useValue: service }],
    }).compile()
    const result = { isFavorite: true, rating: 10, isHidden: false }

    return {
      controller: moduleRef.get(CollectionUserController),
      service,
      result,
      id: new Types.ObjectId(),
    }
  }

  it("передаёт cookie и id при чтении личной реакции", async () => {
    const { controller, service, result, id } = await createController()
    service.getUser.mockResolvedValue(result)
    await expect(controller.getUser("token", id)).resolves.toBe(result)
    expect(service.getUser).toHaveBeenCalledTimes(1)
    expect(service.getUser).toHaveBeenCalledWith("token", id)
  })

  it.each([true, false])(
    "передаёт только isFavorite=%s при изменении избранного",
    async (isFavorite) => {
      const { controller, service, result, id } = await createController()
      service.updateReaction.mockResolvedValue(result)
      await expect(
        controller.updateFavorite("token", id, { isFavorite }),
      ).resolves.toBe(result)
      expect(service.updateReaction).toHaveBeenCalledTimes(1)
      expect(service.updateReaction).toHaveBeenCalledWith("token", {
        id,
        reaction: { isFavorite },
      })
    },
  )

  it.each([1, 10, null])(
    "передаёт оценку %s без подмены null",
    async (rating) => {
      const { controller, service, result, id } = await createController()
      service.updateReaction.mockResolvedValue(result)
      await expect(
        controller.updateRating("token", id, { rating }),
      ).resolves.toBe(result)
      expect(service.updateReaction).toHaveBeenCalledTimes(1)
      expect(service.updateReaction).toHaveBeenCalledWith("token", {
        id,
        reaction: { rating },
      })
    },
  )

  it.each([true, false])(
    "передаёт только isHidden=%s при изменении скрытия",
    async (isHidden) => {
      const { controller, service, result, id } = await createController()
      service.updateReaction.mockResolvedValue(result)
      await expect(
        controller.updateHidden("token", id, { isHidden }),
      ).resolves.toBe(result)
      expect(service.updateReaction).toHaveBeenCalledTimes(1)
      expect(service.updateReaction).toHaveBeenCalledWith("token", {
        id,
        reaction: { isHidden },
      })
    },
  )

  it("передаёт отсутствующий cookie и сохраняет ошибку чтения", async () => {
    const { controller, service, id } = await createController()
    const error = new UnauthorizedException()
    service.getUser.mockRejectedValue(error)
    await expect(controller.getUser(undefined, id)).rejects.toBe(error)
    expect(service.getUser).toHaveBeenCalledTimes(1)
    expect(service.getUser).toHaveBeenCalledWith(undefined, id)
  })

  it.each(["updateFavorite", "updateRating", "updateHidden"] as const)(
    "сохраняет ошибку сервиса для %s",
    async (method) => {
      const { controller, service, id } = await createController()
      const error = new ConflictException()
      service.updateReaction.mockRejectedValue(error)
      const body = { isFavorite: false, rating: null, isHidden: false }
      await expect(controller[method](undefined, id, body)).rejects.toBe(error)
    },
  )
})
