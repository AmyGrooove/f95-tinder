import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { Test } from "@nestjs/testing"
import { Types } from "mongoose"

import { EItemType } from "@entities/item/schemas/EItemType"
import { ItemTagRepository } from "@entities/itemTag/services/itemTag.repository"
import type { ITasteItemTag } from "@entities/itemTag/types/ITasteItemTag"
import { ETagGroup } from "@entities/tag/schemas/ETagGroup"
import { UserRepository } from "@entities/user/services/user.repository"
import { EUserItemStatus } from "@entities/userItem/schemas/EUserItemStatus"
import { UserItemRepository } from "@entities/userItem/services/userItem.repository"
import { JobService } from "@infrastructure/jobs/services/job.service"
import type { IJobContext } from "@infrastructure/jobs/types/IJobContext"

import { UserTasteProfileRepository } from "../services/userTasteProfile.repository"
import { UserTasteProfileRecalculationService } from "../services/userTasteProfileRecalculation.service"
import { RECALCULATE_USER_TASTE_PROFILE_JOB } from "../static/RECALCULATE_USER_TASTE_PROFILE_JOB"

describe("UserTasteProfileRecalculationService", () => {
  const userId = new Types.ObjectId()
  const item = new Types.ObjectId()
  const tag = new Types.ObjectId()
  const exists = jest.fn<() => Promise<boolean>>()
  const findMany =
    jest.fn<
      (
        filter: unknown,
        projection: unknown,
      ) => Promise<
        { item: Types.ObjectId; rating: number | null; isFavorite: boolean }[]
      >
    >()
  const getTasteTags = jest.fn<ItemTagRepository["getTasteTags"]>()
  const publish =
    jest.fn<UserTasteProfileRepository["tryReplaceCalculatedPreferences"]>()
  const add = jest.fn<JobService["add"]>()
  const context = {
    id: "test",
    attempt: 1,
    throwIfCancelled: jest.fn<IJobContext["throwIfCancelled"]>(),
    updateProgress: jest.fn<IJobContext["updateProgress"]>(),
  }
  let service: UserTasteProfileRecalculationService

  beforeEach(async () => {
    exists.mockReset().mockResolvedValue(true)
    findMany
      .mockReset()
      .mockResolvedValue([{ item, rating: 10, isFavorite: false }])
    getTasteTags.mockReset().mockResolvedValue([
      {
        item,
        tag,
        group: ETagGroup.GENRE,
        itemType: EItemType.MOVIE,
        relevanceScore: 1,
      },
    ])
    publish.mockReset().mockResolvedValue(true)
    add.mockReset().mockResolvedValue("queued")
    context.throwIfCancelled.mockReset().mockResolvedValue(undefined)
    context.updateProgress.mockReset().mockResolvedValue(undefined)
    const module = await Test.createTestingModule({
      providers: [
        UserTasteProfileRecalculationService,
        { provide: JobService, useValue: { add } },
        {
          provide: UserRepository,
          useValue: { read: { checkIsExists: exists } },
        },
        { provide: UserItemRepository, useValue: { read: { findMany } } },
        { provide: ItemTagRepository, useValue: { getTasteTags } },
        {
          provide: UserTasteProfileRepository,
          useValue: { tryReplaceCalculatedPreferences: publish },
        },
      ],
    }).compile()
    service = module.get(UserTasteProfileRecalculationService)
    await module.close()
  })

  it.each([
    [1, false, -1],
    [2, false, -0.75],
    [3, false, -0.5],
    [4, false, -0.25],
    [5, false, 0],
    [6, false, 0],
    [7, false, 0.25],
    [8, false, 0.5],
    [9, false, 0.75],
    [10, false, 1],
    [1, true, -1],
    [2, true, -0.75],
    [3, true, -0.5],
    [4, true, -0.25],
    [5, true, 0.8],
    [6, true, 0.8],
    [7, true, 0.85],
    [8, true, 0.9],
    [9, true, 0.95],
    [10, true, 1],
    [null, true, 0.8],
  ])(
    "учитывает оценку %s и избранное %s как вклад %s",
    async (rating, isFavorite, weight) => {
      findMany.mockResolvedValue([{ item, rating, isFavorite }])
      await expect(service.recalculate(userId, context)).resolves.toEqual({
        calculatedTags: 1,
      })
      const preferences = publish.mock.calls[0]?.[1]
      expect(preferences).toHaveLength(1)
      expect(preferences?.[0]).toMatchObject({ tag, count: 1 })
      expect(preferences?.[0]?.weight).toBeCloseTo(weight)
      expect(context.updateProgress).toHaveBeenCalledWith({ progress: 100 })
    },
  )

  it("усредняет выраженность по произведениям, включая нейтральную оценку", async () => {
    const second = new Types.ObjectId()
    findMany.mockResolvedValue([
      { item, rating: 10, isFavorite: false },
      { item: second, rating: 6, isFavorite: false },
    ])
    getTasteTags.mockResolvedValue([
      {
        item,
        tag,
        group: ETagGroup.GENRE,
        itemType: EItemType.MOVIE,
        relevanceScore: 0.2,
      },
      {
        item: second,
        tag,
        group: ETagGroup.GENRE,
        itemType: EItemType.GAME,
        relevanceScore: 1,
      },
    ])
    await service.recalculate(userId, context)
    expect(publish).toHaveBeenCalledWith(userId, [
      { tag, weight: 0.1, count: 2 },
    ])
  })

  it("ослабляет единственный вклад выраженностью тега", async () => {
    getTasteTags.mockResolvedValue([
      {
        item,
        tag,
        group: ETagGroup.GENRE,
        itemType: EItemType.MOVIE,
        relevanceScore: 0.2,
      },
    ])
    await service.recalculate(userId, context)
    expect(publish).toHaveBeenCalledWith(userId, [
      { tag, weight: 0.2, count: 1 },
    ])
  })

  it("не переносит признаки на недопустимый тип и не учитывает неизвестное произведение", async () => {
    const records: ITasteItemTag[] = [
      {
        item,
        tag,
        group: ETagGroup.DURATION,
        itemType: EItemType.GAME,
        relevanceScore: 1,
      },
      {
        item: new Types.ObjectId(),
        tag,
        group: ETagGroup.GENRE,
        itemType: EItemType.MOVIE,
        relevanceScore: 1,
      },
    ]
    getTasteTags.mockResolvedValue(records)
    await service.recalculate(userId, context)
    expect(publish).toHaveBeenCalledWith(userId, [])
  })

  it("читает только реакции владельца вне skipped и передаёт только вкусовые группы", async () => {
    await service.recalculate(userId, context)
    expect(findMany).toHaveBeenCalledWith(
      {
        user: userId,
        status: { $ne: EUserItemStatus.SKIPPED },
        $or: [{ rating: { $ne: null } }, { isFavorite: true }],
      },
      { item: 1, rating: 1, isFavorite: 1 },
    )
    const groups = getTasteTags.mock.calls[0]?.[1]
    expect(groups).toContain(ETagGroup.GENRE)
    expect(groups).not.toContain(ETagGroup.COUNTRY)
  })

  it("публикует пустую пересборку без запроса тегов при отсутствии реакций", async () => {
    findMany.mockResolvedValue([])
    await service.recalculate(userId, context)
    expect(getTasteTags).not.toHaveBeenCalled()
    expect(publish).toHaveBeenCalledWith(userId, [])
  })

  it("пропускает несуществующего пользователя", async () => {
    exists.mockResolvedValue(false)
    await expect(service.recalculate(userId, context)).resolves.toEqual({
      calculatedTags: 0,
    })
    expect(findMany).not.toHaveBeenCalled()
    expect(publish).not.toHaveBeenCalled()
  })

  it("повторяет публикацию после конфликтов и не меняет рассчитанные вклады", async () => {
    publish.mockResolvedValueOnce(false).mockResolvedValueOnce(false)
    await service.recalculate(userId, context)
    expect(publish).toHaveBeenCalledTimes(3)
    expect(findMany).toHaveBeenCalledTimes(1)
    expect(publish.mock.calls[2]).toEqual(publish.mock.calls[0])
  })

  it.each([1, 2, 3, 4])(
    "прерывает работу при отмене на проверке %i",
    async (checkpoint) => {
      const error = new Error("cancelled")
      let calls = 0
      publish.mockResolvedValueOnce(false)
      context.throwIfCancelled.mockImplementation(async () => {
        calls += 1
        if (calls === checkpoint) {
          throw error
        }
      })
      await expect(service.recalculate(userId, context)).rejects.toBe(error)
      expect(publish).toHaveBeenCalledTimes(checkpoint === 4 ? 1 : 0)
      expect(context.updateProgress).not.toHaveBeenCalled()
    },
  )

  it("передаёт ошибку публикации очереди без ложного завершения", async () => {
    const error = new Error("database unavailable")
    publish.mockRejectedValue(error)
    await expect(service.recalculate(userId, context)).rejects.toBe(error)
    expect(context.updateProgress).not.toHaveBeenCalled()
  })

  it("ставит версионированную задачу с повторами и сохранением следующего запуска", async () => {
    await expect(service.enqueue(userId)).resolves.toBe("queued")
    expect(RECALCULATE_USER_TASTE_PROFILE_JOB).toMatchObject({
      name: "userTasteProfile.recalculate",
      version: 1,
      retryDelays: [5000, 30000, 120000],
    })
    expect(add).toHaveBeenCalledWith(
      RECALCULATE_USER_TASTE_PROFILE_JOB,
      String(userId),
      {
        deduplication: {
          id: `userTasteProfile.recalculate:${userId}`,
          keepLastIfActive: true,
        },
      },
    )
  })
})
