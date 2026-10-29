import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { Types } from "mongoose"

import type { TagItemRepository } from "@entities/tagItem/services/tagItem.repository"
import { ETagGroup } from "@entities/tag/schemas/ETagGroup"
import type { TagRepository } from "@entities/tag/services/tag.repository"
import { TAG_GROUP_RULES } from "@entities/tag/static/TAG_GROUP_RULES"
import { JobCancelledError } from "@infrastructure/jobs/errors/JobCancelledError"
import type { IJobContext } from "@infrastructure/jobs/types/IJobContext"

import { RecalculateTagWeightModifiersJobHandler } from "../handlers/recalculateTagWeightModifiersJob.handler"

describe("RecalculateTagWeightModifiersJobHandler", () => {
  const findMany =
    jest.fn<
      (
        ...args: Parameters<TagRepository["read"]["findMany"]>
      ) => Promise<{ _id: Types.ObjectId }[]>
    >()
  const bulkWrite =
    jest.fn<
      (
        ...args: Parameters<TagRepository["bulk"]["bulkWrite"]>
      ) => Promise<{ modifiedCount: number }>
    >()
  const getUsageCounts = jest.fn<TagItemRepository["getUsageCounts"]>()
  const context = {
    id: "recalculation",
    attempt: 1,
    throwIfCancelled: jest.fn<IJobContext["throwIfCancelled"]>(),
    updateProgress: jest.fn<IJobContext["updateProgress"]>(),
  } satisfies IJobContext
  const handler = new RecalculateTagWeightModifiersJobHandler(
    { read: { findMany }, bulk: { bulkWrite } } as unknown as TagRepository,
    { getUsageCounts } as unknown as TagItemRepository,
  )
  const tagId = new Types.ObjectId()

  beforeEach(() => {
    jest.resetAllMocks()
    findMany.mockResolvedValue([])
    getUsageCounts.mockResolvedValue({ itemCount: 0, tagCounts: [] })
    bulkWrite.mockResolvedValue({ modifiedCount: 0 })
    context.throwIfCancelled.mockResolvedValue(undefined)
    context.updateProgress.mockResolvedValue(undefined)
  })

  it.each([
    { itemCount: 100, count: 100, expected: 0.25 },
    { itemCount: 100, count: 80, expected: 0.25 },
    { itemCount: 9, count: 4, expected: 0.6931471805599453 },
    { itemCount: 100, count: 1, expected: 2 },
    { itemCount: 0, count: 0, expected: 1 },
    { itemCount: 0, count: 1, expected: 1 },
    { itemCount: 10, count: 0, expected: 1 },
    { itemCount: 10, count: undefined, expected: 1 },
  ])(
    "записывает коэффициент $expected при N=$itemCount и n=$count только существующему тегу его группы",
    async ({ itemCount, count, expected }) => {
      findMany.mockResolvedValueOnce([{ _id: tagId }])
      getUsageCounts.mockResolvedValue({
        itemCount,
        tagCounts:
          count === undefined
            ? []
            : [{ _id: new Types.ObjectId(String(tagId)), count }],
      })

      await handler.handle(null, context)

      expect(bulkWrite).toHaveBeenCalledTimes(1)
      expect(bulkWrite).toHaveBeenCalledWith(
        [
          {
            updateOne: {
              filter: { _id: tagId, group: ETagGroup.GENRE },
              update: { $set: { weightModifier: expected } },
            },
          },
        ],
        { ordered: false },
      )
    },
  )

  it("обходит только вкусовые группы, не пишет пустые группы и завершает прогресс на 100", async () => {
    const groups = Object.values(ETagGroup).filter(
      (group) => TAG_GROUP_RULES[group].isUsedForTaste,
    )

    await expect(handler.handle(null, context)).resolves.toEqual({
      processedGroups: groups.length,
      updatedTags: 0,
    })
    expect(findMany.mock.calls).toEqual(
      groups.map((group) => [{ group }, { _id: 1 }]),
    )
    expect(getUsageCounts).not.toHaveBeenCalled()
    expect(bulkWrite).not.toHaveBeenCalled()
    expect(context.updateProgress).toHaveBeenCalledTimes(groups.length)
    expect(context.updateProgress).toHaveBeenLastCalledWith({ progress: 100 })
    const progress = context.updateProgress.mock.calls.map(
      ([value]) => value.progress,
    )
    expect(progress).toEqual(
      [...progress].sort((first, second) => first - second),
    )
  })

  it("передаёт разрешённые типы группы и считает фактически изменённые документы", async () => {
    findMany.mockImplementation(async ({ group }) => {
      return group === ETagGroup.GAME_MECHANIC ? [{ _id: tagId }] : []
    })
    bulkWrite.mockResolvedValue({ modifiedCount: 1 })

    const result = await handler.handle(null, context)

    expect(getUsageCounts).toHaveBeenCalledWith(
      [tagId],
      TAG_GROUP_RULES[ETagGroup.GAME_MECHANIC].itemTypes,
    )
    expect(result.updatedTags).toBe(1)
  })

  it("суммирует modifiedCount нескольких групп вместо числа отправленных обновлений", async () => {
    const secondId = new Types.ObjectId()
    findMany
      .mockResolvedValueOnce([{ _id: tagId }, { _id: secondId }])
      .mockResolvedValueOnce([{ _id: new Types.ObjectId() }])
    bulkWrite
      .mockResolvedValueOnce({ modifiedCount: 1 })
      .mockResolvedValueOnce({ modifiedCount: 0 })

    const result = await handler.handle(null, context)

    expect(bulkWrite).toHaveBeenCalledTimes(2)
    expect(result.updatedTags).toBe(1)
  })

  it.each(["read", "usage", "write"])(
    "пробрасывает ошибку %s для повторной попытки без дальнейшего прогресса",
    async (stage) => {
      const error = new Error(stage)
      findMany.mockResolvedValueOnce([{ _id: tagId }])

      if (stage === "read") {
        findMany.mockReset().mockRejectedValue(error)
      } else if (stage === "usage") {
        getUsageCounts.mockRejectedValueOnce(error)
      } else {
        bulkWrite.mockRejectedValueOnce(error)
      }

      await expect(handler.handle(null, context)).rejects.toBe(error)
      expect(findMany).toHaveBeenCalledTimes(1)
      expect(context.updateProgress).not.toHaveBeenCalled()
    },
  )

  it.each([1, 2])(
    "останавливает отменённую задачу на проверке %i до записи",
    async (check) => {
      const error = new JobCancelledError()
      findMany.mockResolvedValueOnce([{ _id: tagId }])

      if (check === 2) {
        context.throwIfCancelled.mockResolvedValueOnce(undefined)
      }

      context.throwIfCancelled.mockRejectedValueOnce(error)

      await expect(handler.handle(null, context)).rejects.toBe(error)
      expect(bulkWrite).not.toHaveBeenCalled()
      expect(findMany).toHaveBeenCalledTimes(check === 1 ? 0 : 1)
      expect(context.updateProgress).not.toHaveBeenCalled()
    },
  )

  it("сохраняет результат первой группы при отмене перед следующей", async () => {
    findMany.mockResolvedValueOnce([{ _id: tagId }])
    context.throwIfCancelled
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new JobCancelledError())

    await expect(handler.handle(null, context)).rejects.toBeInstanceOf(
      JobCancelledError,
    )
    expect(bulkWrite).toHaveBeenCalledTimes(1)
    expect(findMany).toHaveBeenCalledTimes(1)
    expect(context.updateProgress).toHaveBeenCalledTimes(1)
  })
})
