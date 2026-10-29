import { afterEach, describe, expect, it, jest } from "@jest/globals"
import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common"
import { Test, type TestingModule } from "@nestjs/testing"
import { Types } from "mongoose"

import { ECollectionType } from "@entities/collection/schemas/ECollectionType"

import { CollectionController } from "../controllers/collection.controller"
import { CollectionService } from "../services/collection.service"

describe("CollectionController", () => {
  let moduleRef: TestingModule | undefined

  afterEach(async () => {
    await moduleRef?.close()
    moduleRef = undefined
  })

  const createController = async () => {
    const service = {
      create: jest.fn<CollectionService["create"]>(),
      update: jest.fn<CollectionService["update"]>(),
      remove: jest.fn<CollectionService["remove"]>(),
    }
    moduleRef = await Test.createTestingModule({
      controllers: [CollectionController],
      providers: [{ provide: CollectionService, useValue: service }],
    }).compile()
    const result = {
      id: new Types.ObjectId().toHexString(),
      version: 0,
      authorId: null,
      type: ECollectionType.CUSTOM,
      title: { ru: "Подборка", en: null },
      description: { ru: null, en: null },
      media: [],
      blocks: [],
      createdAt: "2026-10-23T00:00:00.000Z",
      updatedAt: "2026-10-23T00:00:00.000Z",
    }

    return { controller: moduleRef.get(CollectionController), service, result }
  }

  it("передаёт cookie и тело создания сервису и возвращает его результат", async () => {
    const { controller, service, result } = await createController()
    const body = { title: { ru: "Подборка", en: null } }
    service.create.mockResolvedValue(result)
    await expect(controller.create("token", body)).resolves.toBe(result)
    expect(service.create).toHaveBeenCalledTimes(1)
    expect(service.create).toHaveBeenCalledWith("token", body)
  })

  it("передаёт ObjectId и версию 0 при обновлении и возвращает результат", async () => {
    const { controller, service, result } = await createController()
    const id = new Types.ObjectId()
    const body = { version: 0, media: [] }
    service.update.mockResolvedValue(result)
    await expect(controller.update("token", id, body)).resolves.toBe(result)
    expect(service.update).toHaveBeenCalledTimes(1)
    expect(service.update).toHaveBeenCalledWith("token", { id, body })
  })

  it("передаёт удаление сервису и возвращает пустой результат", async () => {
    const { controller, service } = await createController()
    const id = new Types.ObjectId()
    service.remove.mockResolvedValue(undefined)
    await expect(controller.remove("token", id)).resolves.toBeUndefined()
    expect(service.remove).toHaveBeenCalledTimes(1)
    expect(service.remove).toHaveBeenCalledWith("token", id)
  })

  it("передаёт отсутствующий cookie и сохраняет ошибку создания", async () => {
    const { controller, service } = await createController()
    const body = { title: { ru: "Подборка", en: null } }
    const error = new UnauthorizedException()
    service.create.mockRejectedValue(error)
    await expect(controller.create(undefined, body)).rejects.toBe(error)
    expect(service.create).toHaveBeenCalledTimes(1)
    expect(service.create).toHaveBeenCalledWith(undefined, body)
  })

  it("сохраняет конфликт версии при обновлении", async () => {
    const { controller, service } = await createController()
    const error = new ConflictException()
    service.update.mockRejectedValue(error)
    await expect(
      controller.update(undefined, new Types.ObjectId(), { version: 0 }),
    ).rejects.toBe(error)
  })

  it("сохраняет ошибку отсутствующей подборки при удалении", async () => {
    const { controller, service } = await createController()
    const error = new NotFoundException()
    service.remove.mockRejectedValue(error)
    await expect(
      controller.remove(undefined, new Types.ObjectId()),
    ).rejects.toBe(error)
  })
})
