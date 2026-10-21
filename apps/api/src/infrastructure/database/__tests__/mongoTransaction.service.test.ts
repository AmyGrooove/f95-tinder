import { describe, expect, it, jest } from "@jest/globals"
import type { ClientSession, Connection } from "mongoose"

import { MongoTransactionService } from "../services/mongoTransaction.service"

describe("MongoTransactionService", () => {
  it("передаёт session и опции и возвращает результат после закрытия session", async () => {
    const endSession = jest.fn<() => Promise<void>>().mockResolvedValue()
    const withTransaction = jest.fn(
      async (
        callback: () => Promise<unknown>,
        options?: Parameters<ClientSession["withTransaction"]>[1],
      ) => {
        expect(options).toEqual({ maxCommitTimeMS: 1000 })
        return await callback()
      },
    )
    const session = { withTransaction, endSession }
    const startSession = jest.fn(async () => session)
    const service = new MongoTransactionService({
      startSession,
    } as unknown as Connection)
    const result = { value: 42 }
    const callback = jest.fn(async (received: ClientSession) => {
      expect(received).toBe(session)
      expect(endSession).not.toHaveBeenCalled()
      return result
    })
    const options = { maxCommitTimeMS: 1000 }

    await expect(service.run(callback, options)).resolves.toBe(result)
    expect(startSession).toHaveBeenCalledTimes(1)
    expect(withTransaction).toHaveBeenCalledWith(expect.any(Function), options)
    expect(endSession).toHaveBeenCalledTimes(1)
  })

  it.each(["callback", "transaction"])(
    "закрывает session при ошибке %s",
    async (source) => {
      const error = new Error(source)
      const endSession = jest.fn<() => Promise<void>>().mockResolvedValue()
      const withTransaction = async (callback: () => Promise<unknown>) => {
        if (source === "transaction") {
          throw error
        }
        return await callback()
      }
      const service = new MongoTransactionService({
        startSession: async () => ({ withTransaction, endSession }),
      } as unknown as Connection)

      await expect(
        service.run(async () => {
          throw error
        }),
      ).rejects.toBe(error)
      expect(endSession).toHaveBeenCalledTimes(1)
    },
  )

  it("передаёт ошибку создания session без выполнения callback", async () => {
    const error = new Error("start failed")
    const callback = jest.fn<() => Promise<void>>()
    const service = new MongoTransactionService({
      startSession: async () => {
        throw error
      },
    } as unknown as Connection)

    await expect(service.run(callback)).rejects.toBe(error)
    expect(callback).not.toHaveBeenCalled()
  })
})
