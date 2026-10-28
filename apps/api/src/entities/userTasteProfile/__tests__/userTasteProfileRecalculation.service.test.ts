import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { Test } from "@nestjs/testing"
import { Types } from "mongoose"

import { EItemType } from "@entities/item/schemas/EItemType"
import { ItemTagRepository } from "@entities/itemTag/services/itemTag.repository"
import type { ITasteItemTag } from "@entities/itemTag/types/ITasteItemTag"
import { ETagGroup } from "@entities/tag/schemas/ETagGroup"
import { EUnit } from "@entities/shared/schemas/EUnit"
import { UserRepository } from "@entities/user/services/user.repository"
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
  const getTasteInputs = jest.fn<UserItemRepository["getTasteInputs"]>()
  const findAffectedTags = jest.fn<() => Promise<{ tag: Types.ObjectId }[]>>()
  const readTagPreferences =
    jest.fn<UserTasteProfileRepository["readTagPreferences"]>()
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
    findAffectedTags.mockReset().mockResolvedValue([{ tag }])
    readTagPreferences.mockReset().mockResolvedValue(null)
    getTasteInputs
      .mockReset()
      .mockResolvedValue([
        { item, rating: 10, isFavorite: false, attempts: [] },
      ])
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
        { provide: UserItemRepository, useValue: { getTasteInputs } },
        {
          provide: ItemTagRepository,
          useValue: { getTasteTags, read: { findMany: findAffectedTags } },
        },
        {
          provide: UserTasteProfileRepository,
          useValue: {
            tryReplaceCalculatedPreferences: publish,
            readTagPreferences,
          },
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
      getTasteInputs.mockResolvedValue([
        { item, rating, isFavorite, attempts: [] },
      ])
      await expect(
        service.recalculate({ userId, itemId: item }, context),
      ).resolves.toEqual({
        calculatedTags: 1,
      })
      const preferences = publish.mock.calls[0]?.[0].preferences
      expect(preferences).toHaveLength(1)
      expect(preferences?.[0]).toMatchObject({ tag, count: 1 })
      expect(preferences?.[0]?.weight).toBeCloseTo(weight)
      expect(context.updateProgress).toHaveBeenCalledWith({ progress: 100 })
    },
  )

  it("усредняет выраженность по произведениям, включая нейтральную оценку", async () => {
    const second = new Types.ObjectId()
    getTasteInputs.mockResolvedValue([
      { item, rating: 10, isFavorite: false, attempts: [] },
      { item: second, rating: 6, isFavorite: false, attempts: [] },
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
    await service.recalculate({ userId, itemId: item }, context)
    expect(publish).toHaveBeenCalledWith({
      userId,
      tagIds: [tag],
      previousPreferences: null,
      preferences: [{ tag, weight: 0.1, count: 2 }],
    })
  })

  it.each([
    { rating: null, isFavorite: false, completed: 0, weight: 0 },
    { rating: null, isFavorite: false, completed: 1, weight: 0.1 },
    { rating: null, isFavorite: false, completed: 2, weight: 0.2 },
    { rating: null, isFavorite: false, completed: 3, weight: 0.3 },
    { rating: null, isFavorite: false, completed: 8, weight: 0.3 },
    { rating: 5, isFavorite: false, completed: 2, weight: 0.2 },
    { rating: 7, isFavorite: false, completed: 2, weight: 0.45 },
    { rating: 9, isFavorite: false, completed: 3, weight: 1 },
    { rating: 10, isFavorite: false, completed: 1, weight: 1 },
    { rating: 7, isFavorite: true, completed: 1, weight: 0.95 },
    { rating: null, isFavorite: true, completed: 3, weight: 1 },
    { rating: 1, isFavorite: true, completed: 3, weight: -1 },
    { rating: 4, isFavorite: false, completed: 3, weight: -0.25 },
  ])(
    "учитывает $completed завершённых попыток при оценке $rating и избранном $isFavorite как $weight",
    async ({ rating, isFavorite, completed, weight }) => {
      getTasteInputs.mockResolvedValue([
        {
          item,
          rating,
          isFavorite,
          attempts: Array.from({ length: completed + 2 }, (_, index) => ({
            id: new Types.ObjectId(),
            isCompleted: index < completed,
            progress: 100,
            unit: EUnit.PERCENT,
            startedAt: null,
            completedAt: new Date("2026-10-01T00:00:00Z"),
          })),
        },
      ])

      await service.recalculate({ userId, itemId: item }, context)

      const preference = publish.mock.calls[0]?.[0].preferences[0]
      expect(preference).toMatchObject({ tag, count: 1 })
      expect(preference?.weight).toBeCloseTo(weight)
    },
  )

  it("не читает профиль и библиотеку, если у изменённого Item нет тегов", async () => {
    findAffectedTags.mockResolvedValue([])

    await expect(
      service.recalculate({ userId, itemId: item }, context),
    ).resolves.toEqual({ calculatedTags: 0 })

    expect(readTagPreferences).not.toHaveBeenCalled()
    expect(getTasteInputs).not.toHaveBeenCalled()
    expect(publish).not.toHaveBeenCalled()
  })

  it("при конфликте перечитывает профиль и публикует новый расчёт вместо устаревшего", async () => {
    const updatedPreferences = [
      { tag, weight: 0, count: 1, explicitWeight: -0.4 },
    ]
    readTagPreferences
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(updatedPreferences)
    getTasteInputs
      .mockResolvedValueOnce([
        { item, rating: 10, isFavorite: false, attempts: [] },
      ])
      .mockResolvedValueOnce([
        { item, rating: 1, isFavorite: false, attempts: [] },
      ])
    publish.mockResolvedValueOnce(false)

    await service.recalculate({ userId, itemId: item }, context)

    expect(publish.mock.calls[0]?.[0]).toMatchObject({
      previousPreferences: null,
      preferences: [{ tag, weight: 1, count: 1 }],
    })
    expect(publish.mock.calls[1]?.[0]).toMatchObject({
      previousPreferences: updatedPreferences,
      preferences: [{ tag, weight: -1, count: 1 }],
    })
    expect(readTagPreferences.mock.invocationCallOrder[0]).toBeLessThan(
      getTasteInputs.mock.invocationCallOrder[0],
    )
    expect(readTagPreferences.mock.invocationCallOrder[1]).toBeLessThan(
      getTasteInputs.mock.invocationCallOrder[1],
    )
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
    await service.recalculate({ userId, itemId: item }, context)
    expect(publish).toHaveBeenCalledWith({
      userId,
      tagIds: [tag],
      previousPreferences: null,
      preferences: [{ tag, weight: 0.2, count: 1 }],
    })
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
    await service.recalculate({ userId, itemId: item }, context)
    expect(publish).toHaveBeenCalledWith({
      userId,
      tagIds: [tag],
      previousPreferences: null,
      preferences: [],
    })
  })

  it("читает только реакции владельца вне skipped и передаёт только вкусовые группы", async () => {
    await service.recalculate({ userId, itemId: item }, context)
    expect(getTasteInputs).toHaveBeenCalledWith(userId, [tag])
    expect(getTasteTags.mock.calls[0]?.[0]).toMatchObject({
      itemIds: [item],
      tagIds: [tag],
    })
    const groups = getTasteTags.mock.calls[0]?.[0].groups
    expect(groups).toContain(ETagGroup.GENRE)
    expect(groups).not.toContain(ETagGroup.COUNTRY)
  })

  it("публикует пустую пересборку без запроса тегов при отсутствии реакций", async () => {
    getTasteInputs.mockResolvedValue([])
    await service.recalculate({ userId, itemId: item }, context)
    expect(getTasteTags).not.toHaveBeenCalled()
    expect(publish).toHaveBeenCalledWith({
      userId,
      tagIds: [tag],
      previousPreferences: null,
      preferences: [],
    })
  })

  it("пропускает несуществующего пользователя", async () => {
    exists.mockResolvedValue(false)
    await expect(
      service.recalculate({ userId, itemId: item }, context),
    ).resolves.toEqual({
      calculatedTags: 0,
    })
    expect(getTasteInputs).not.toHaveBeenCalled()
    expect(publish).not.toHaveBeenCalled()
  })

  it("заново читает источники и рассчитывает вклады после конфликтов публикации", async () => {
    publish.mockResolvedValueOnce(false).mockResolvedValueOnce(false)
    await service.recalculate({ userId, itemId: item }, context)
    expect(publish).toHaveBeenCalledTimes(3)
    expect(getTasteInputs).toHaveBeenCalledTimes(3)
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
      await expect(
        service.recalculate({ userId, itemId: item }, context),
      ).rejects.toBe(error)
      expect(publish).toHaveBeenCalledTimes(checkpoint === 4 ? 1 : 0)
      expect(context.updateProgress).not.toHaveBeenCalled()
    },
  )

  it("передаёт ошибку публикации очереди без ложного завершения", async () => {
    const error = new Error("database unavailable")
    publish.mockRejectedValue(error)
    await expect(
      service.recalculate({ userId, itemId: item }, context),
    ).rejects.toBe(error)
    expect(context.updateProgress).not.toHaveBeenCalled()
  })

  it("ставит версионированную задачу с повторами и сохранением следующего запуска", async () => {
    await expect(service.enqueue(userId, item)).resolves.toBe("queued")
    expect(RECALCULATE_USER_TASTE_PROFILE_JOB).toMatchObject({
      name: "userTasteProfile.recalculate",
      version: 2,
      retryDelays: [5000, 30000, 120000],
    })
    expect(add).toHaveBeenCalledWith(
      RECALCULATE_USER_TASTE_PROFILE_JOB,
      { userId: String(userId), itemId: String(item) },
      {
        deduplication: {
          id: `userTasteProfile.recalculate:${userId}:${item}`,
          keepLastIfActive: true,
        },
      },
    )
  })
})
