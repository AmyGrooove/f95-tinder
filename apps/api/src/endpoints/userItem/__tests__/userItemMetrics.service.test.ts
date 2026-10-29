import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { Types } from "mongoose"
import type { ClientSession } from "mongoose"

import type { ItemMetricRepository } from "@entities/itemMetric/services/itemMetric.repository"
import type { SiteRatingsMetricRepository } from "@entities/siteMetric/services/siteRatingsMetric.repository"
import { EUserItemStatus } from "@entities/userItem/schemas/EUserItemStatus"
import type { UserItem } from "@entities/userItem/schemas/userItem.schema"

import { UserItemMetricsService } from "../services/userItemMetrics.service"
import type { IUserItemMetricState } from "../types/IUserItemMetricState"

describe("UserItemMetricsService", () => {
  const itemId = new Types.ObjectId()
  const session = {} as ClientSession
  const applyItem = jest.fn<ItemMetricRepository["applyChanges"]>()
  const applySite = jest.fn<SiteRatingsMetricRepository["applyChanges"]>()
  const service = new UserItemMetricsService(
    { applyChanges: applyItem } as unknown as ItemMetricRepository,
    { applyChanges: applySite } as unknown as SiteRatingsMetricRepository,
  )
  const state = (rating: number | null): IUserItemMetricState => ({
    rating,
    isFavorite: false,
    status: EUserItemStatus.PLANNED,
    completedAttemptsCount: 0,
  })

  beforeEach(() => {
    applyItem.mockReset()
    applySite.mockReset()
  })

  it.each([
    { previous: null, next: 7, sum: 7, count: 1, seven: 1, nine: 0 },
    { previous: 7, next: 9, sum: 2, count: 0, seven: -1, nine: 1 },
    { previous: 9, next: null, sum: -9, count: -1, seven: 0, nine: -1 },
  ])(
    "передаёт точную разницу оценки $previous → $next и ту же session",
    async ({ previous, next, sum, count, seven, nine }) => {
      await service.update({
        itemId,
        previous: state(previous),
        next: state(next),
        session,
      })

      expect(applyItem).toHaveBeenCalledTimes(1)
      expect(applyItem).toHaveBeenCalledWith({
        itemId,
        session,
        ratingsCount: count,
        favoritesCount: 0,
        completedAttemptsCount: 0,
        ratingDistribution: {
          one: 0,
          two: 0,
          three: 0,
          four: 0,
          five: 0,
          six: 0,
          seven,
          eight: 0,
          nine,
          ten: 0,
        },
        statusCounts: {
          planned: 0,
          inProgress: 0,
          onHold: 0,
          completed: 0,
          dropped: 0,
        },
      })
      expect(applySite).toHaveBeenCalledWith({ sum, count, session })
      expect(applyItem.mock.invocationCallOrder[0]).toBeLessThan(
        applySite.mock.invocationCallOrder[0],
      )
    },
  )

  it.each(["create", "delete"] as const)(
    "учитывает оценку, избранное, статус и все попытки при %s",
    async (operation) => {
      const value = {
        ...state(10),
        isFavorite: true,
        status: EUserItemStatus.COMPLETED,
        completedAttemptsCount: 6,
      }
      await service.update({
        itemId,
        previous: operation === "create" ? null : value,
        next: operation === "create" ? value : null,
        session,
      })

      const sign = operation === "create" ? 1 : -1
      expect(applyItem).toHaveBeenCalledWith(
        expect.objectContaining({
          ratingsCount: sign,
          favoritesCount: sign,
          completedAttemptsCount: sign * 6,
          ratingDistribution: expect.objectContaining({ ten: sign }),
          statusCounts: expect.objectContaining({ completed: sign }),
        }),
      )
      expect(applySite).toHaveBeenCalledWith({
        sum: sign * 10,
        count: sign,
        session,
      })
    },
  )

  it("сохраняет вклад blocked, но исключает его из библиотечных статусов", async () => {
    await service.update({
      itemId,
      previous: state(7),
      next: { ...state(7), status: EUserItemStatus.BLOCKED },
      session,
    })

    expect(applyItem).toHaveBeenCalledWith(
      expect.objectContaining({
        ratingsCount: 0,
        statusCounts: {
          planned: -1,
          inProgress: 0,
          onHold: 0,
          completed: 0,
          dropped: 0,
        },
      }),
    )
    expect(applySite).not.toHaveBeenCalled()
  })

  it("обновляет избранное и попытки без записи общей метрики оценок", async () => {
    await service.update({
      itemId,
      previous: state(null),
      next: { ...state(null), isFavorite: true, completedAttemptsCount: 4 },
      session,
    })

    expect(applyItem).toHaveBeenCalledWith(
      expect.objectContaining({
        favoritesCount: 1,
        completedAttemptsCount: 4,
        ratingsCount: 0,
      }),
    )
    expect(applySite).not.toHaveBeenCalled()
  })

  it.each(["same", "skipCreate", "skipDelete", "empty"])(
    "не пишет метрики без изменения вклада: %s",
    async (kind) => {
      const skipped = { ...state(null), status: EUserItemStatus.SKIPPED }
      await service.update({
        itemId,
        previous:
          kind === "same" ? state(7) : kind === "skipDelete" ? skipped : null,
        next:
          kind === "same" ? state(7) : kind === "skipCreate" ? skipped : null,
        session,
      })

      expect(applyItem).not.toHaveBeenCalled()
      expect(applySite).not.toHaveBeenCalled()
    },
  )

  it("делает независимый снимок состояния без ограничения числа завершений", () => {
    const record = {
      ...state(7),
      attempts: Array.from({ length: 7 }, (_, index) => ({
        isCompleted: index < 6,
      })),
    } as unknown as UserItem
    const snapshot = service.getState(record)
    record.rating = 9
    record.attempts[0].isCompleted = false

    expect(snapshot).toEqual({ ...state(7), completedAttemptsCount: 6 })
  })

  it.each(["item", "site"])(
    "передаёт ошибку репозитория %s в транзакцию",
    async (dependency) => {
      const error = new Error("Запись метрик не удалась")
      if (dependency === "item") {
        applyItem.mockRejectedValueOnce(error)
      } else {
        applySite.mockRejectedValueOnce(error)
      }

      await expect(
        service.update({ itemId, previous: null, next: state(7), session }),
      ).rejects.toBe(error)
      if (dependency === "item") {
        expect(applySite).not.toHaveBeenCalled()
      }
    },
  )
})
