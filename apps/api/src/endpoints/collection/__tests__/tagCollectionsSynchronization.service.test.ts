import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { Types } from "mongoose"
import type { Connection } from "mongoose"

import { TagItemEventsService } from "@entities/tagItem/services/tagItemEvents.service"
import { MongoTransactionService } from "@infrastructure/database/services/mongoTransaction.service"
import type { JobService } from "@infrastructure/jobs/services/job.service"
import { TagCollectionsSynchronizationService } from "../services/tagCollectionsSynchronization.service"

describe("TagCollectionsSynchronizationService", () => {
  const add = jest.fn<JobService["add"]>()
  let events: TagItemEventsService
  let service: TagCollectionsSynchronizationService

  beforeEach(() => {
    add.mockReset().mockResolvedValue("queued")
    events = new TagItemEventsService(
      new MongoTransactionService({} as Connection),
    )
    service = new TagCollectionsSynchronizationService(events, {
      add,
    } as unknown as JobService)
    service.onModuleInit()
  })

  it("объединяет повторные Item в событии и сохраняет отдельные ключи для разных произведений", async () => {
    const first = new Types.ObjectId()
    const second = new Types.ObjectId()

    await events.publishChanged([
      first,
      new Types.ObjectId(String(first)),
      second,
    ])

    expect(add).toHaveBeenCalledTimes(2)
    for (const [index, item] of [first, second].entries()) {
      expect(add).toHaveBeenNthCalledWith(
        index + 1,
        {
          name: "collection.synchronizeTags",
          version: 1,
          retryDelays: [5000, 30000, 120000],
        },
        String(item),
        {
          deduplication: {
            id: `collection.synchronizeTags:${item}`,
            keepLastIfActive: true,
          },
        },
      )
    }
  })

  it("не ставит задания для пустого события и после удаления подписки", async () => {
    await events.publishChanged([])
    service.onModuleDestroy()
    await events.publishChanged([new Types.ObjectId()])

    expect(add).not.toHaveBeenCalled()
  })

  it("передаёт ошибку очереди вызывающему коду", async () => {
    const error = new Error("Redis unavailable")
    add.mockRejectedValueOnce(error)

    await expect(events.publishChanged([new Types.ObjectId()])).rejects.toBe(
      error,
    )
  })

  it("возвращает ID задания при явной постановке", async () => {
    await expect(service.enqueue(new Types.ObjectId())).resolves.toBe("queued")
  })
})
