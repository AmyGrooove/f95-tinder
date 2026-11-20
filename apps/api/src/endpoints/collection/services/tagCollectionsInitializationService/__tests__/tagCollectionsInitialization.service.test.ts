import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { getModelToken } from "@nestjs/mongoose"
import { Test } from "@nestjs/testing"
import { Mongoose, mongo } from "mongoose"
import type { HydratedDocument, Types } from "mongoose"

import { Tag, TagSchema } from "@entities/tag/schemas/tag.schema"
import type { TCreateTag } from "@entities/tag/schemas/tag.schema"
import { TagModule } from "@entities/tag/tag.module"
import { TagRepository } from "@entities/tag/services/tagRepository"
import { CollectionModule } from "@entities/collection/collection.module"
import { Collection } from "@entities/collection/schemas/collection.schema"
import { CollectionRepository } from "@entities/collection/services/collectionRepository"
import { TagCollectionsInitializationService } from "../core/tagCollectionsInitialization.service"
import dictionary from "../../../../../../public/import/main/tags/tags.json" with { type: "json" }

describe("TagCollectionsInitializationService", () => {
  const model = new Mongoose().model<Tag>("InitializationTagUnit", TagSchema)
  const records = new Map<string, HydratedDocument<Tag>>()
  const create =
    jest.fn<(payload: TCreateTag) => Promise<HydratedDocument<Tag>>>()
  const ensure =
    jest.fn<(id: Types.ObjectId, title: unknown) => Promise<unknown>>()
  const service = new TagCollectionsInitializationService(
    {
      read: {
        findOne: async ({ key }: { key: string }) => records.get(key) ?? null,
        findMany: async () => [...records.values()],
      },
      write: { create },
    } as unknown as TagRepository,
    {
      ensureForTag: ensure,
    } as unknown as CollectionRepository,
  )

  beforeEach(() => {
    records.clear()
    for (const { tags } of dictionary) {
      for (const tag of tags) {
        records.set(tag.key, new model({ key: tag.key, name: tag.name }))
      }
    }
    ensure.mockReset().mockResolvedValue(null)
    create.mockReset().mockImplementation(async (payload) => {
      const tag = new model(payload)
      records.set(tag.key, tag)
      return tag
    })
  })

  it("проверяет коллекции для всех существующих тегов, включая теги вне справочника, без перезаписи Tag", async () => {
    const extra = new model({
      key: "customTag",
      name: { ru: "Авторское имя", en: null },
    })
    records.set(extra.key, extra)

    await service.onModuleInit()

    expect(create).not.toHaveBeenCalled()
    expect(ensure).toHaveBeenCalledTimes(records.size)
    expect(ensure).toHaveBeenCalledWith(extra._id, extra.name)
    expect(extra.name.ru).toBe("Авторское имя")
  })

  it("создаёт отсутствующих родителей до детей и использует фактические сохранённые ID", async () => {
    records.delete("fantasy")
    records.delete("urbanFantasy")

    await service.onModuleInit()

    expect(create).toHaveBeenCalledTimes(2)
    expect(create.mock.calls.map(([payload]) => payload.key)).toEqual([
      "fantasy",
      "urbanFantasy",
    ])
    expect(records.get("urbanFantasy")?.parents.map(String)).toEqual([
      String(records.get("fantasy")?._id),
    ])

    await service.onModuleInit()
    expect(create).toHaveBeenCalledTimes(2)
  })

  it("использует запись другого экземпляра при конкурентном создании тега", async () => {
    records.delete("fantasy")
    create.mockImplementationOnce(async (payload) => {
      records.set(payload.key, new model(payload))
      throw new mongo.MongoServerError({
        message: "duplicate",
        code: 11000,
        keyPattern: { key: 1 },
      })
    })

    await expect(service.onModuleInit()).resolves.toBeUndefined()
    expect(create).toHaveBeenCalledTimes(1)
    expect(ensure).toHaveBeenCalledTimes(records.size)
  })

  it.each([Tag.name, Collection.name])(
    "останавливает запуск до заполнения справочника при ошибке индекса модели %s",
    async (failedModel) => {
      const indexError = new Error("index failed")
      const modelFor = (name: string) => ({
        init: async () => {
          if (failedModel === name) {
            throw indexError
          }
        },
      })
      const moduleRef = await Test.createTestingModule({
        imports: [TagModule, CollectionModule],
        providers: [TagCollectionsInitializationService],
      })
        .overrideProvider(getModelToken(Tag.name))
        .useValue(modelFor(Tag.name))
        .overrideProvider(getModelToken(Collection.name))
        .useValue(modelFor(Collection.name))
        .compile()
      const readTags = jest.spyOn(moduleRef.get(TagRepository).read, "findOne")
      const ensureForTag = jest.spyOn(
        moduleRef.get(CollectionRepository),
        "ensureForTag",
      )

      await expect(moduleRef.init()).rejects.toBe(indexError)
      expect(readTags).not.toHaveBeenCalled()
      expect(ensureForTag).not.toHaveBeenCalled()
    },
  )

  it("не скрывает ошибку записи, не связанную с конкурентным созданием", async () => {
    records.delete("fantasy")
    create.mockRejectedValueOnce(new Error("write failed"))

    await expect(service.onModuleInit()).rejects.toThrow("write failed")
    expect(ensure).not.toHaveBeenCalled()
  })
})
