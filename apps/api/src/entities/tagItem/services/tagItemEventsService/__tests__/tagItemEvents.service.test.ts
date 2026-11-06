import { describe, expect, it, jest } from "@jest/globals"
import { Types } from "mongoose"

import type { MongoTransactionService } from "@infrastructure/database/services/mongoTransactionService"

import { TagItemEventsService } from ".."

describe("TagItemEventsService", () => {
  it("не планирует уведомление для пустого списка", async () => {
    const afterCommit = jest.fn<MongoTransactionService["afterCommit"]>()
    const service = new TagItemEventsService({
      afterCommit,
    } as unknown as MongoTransactionService)

    await service.publishChanged([])

    expect(afterCommit).not.toHaveBeenCalled()
  })

  it("после коммита передаёт уникальные идентификаторы только активным подписчикам", async () => {
    const afterCommit = jest.fn<MongoTransactionService["afterCommit"]>()
    const service = new TagItemEventsService({
      afterCommit,
    } as unknown as MongoTransactionService)
    const unsubscribed = jest.fn(async () => {})
    const listener = jest.fn<(ids: Types.ObjectId[]) => Promise<void>>()
    const unsubscribe = service.subscribe(unsubscribed)
    service.subscribe(listener)
    const first = new Types.ObjectId()
    const second = new Types.ObjectId()

    await service.publishChanged([first, new Types.ObjectId(first), second])
    expect(listener).not.toHaveBeenCalled()

    unsubscribe()
    const [[notify]] = afterCommit.mock.calls
    await notify()

    expect(unsubscribed).not.toHaveBeenCalled()
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith([first, second])
  })
})
