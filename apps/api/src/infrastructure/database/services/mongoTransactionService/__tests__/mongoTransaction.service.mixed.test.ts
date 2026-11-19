import { describe, expect, it, jest, beforeAll } from "@jest/globals"
import type { ClientSession, Connection } from "mongoose"
import { MongoTransactionService } from "../core/mongoTransaction.service"

if (Reflect.get(globalThis, "IS_INTEGRATION_TEST") === true) {
  const { createRepositoryFixture } =
    await import("../../../__tests__/functions/createRepositoryFixture")

  describe("MongoTransactionService", () => {
    let fixture: Awaited<ReturnType<typeof createRepositoryFixture>>
    let service: MongoTransactionService

    beforeAll(async () => {
      fixture = await createRepositoryFixture("RepositoryTransactionTest")
      service = new MongoTransactionService(fixture.connection)
    })

    it("фиксирует изменения и возвращает результат callback", async () => {
      const result = await service.run(async (session) => {
        const created = await fixture.write.create(
          { key: "one", score: 1 },
          { session },
        )
        await fixture.write.updateById(
          created.id,
          { $set: { score: 2 } },
          { session },
        )
        await fixture.bulk.createMany([{ key: "two", score: 3 }], { session })
        await fixture.bulk.updateMany(
          { key: "two" },
          { $set: { score: 4 } },
          { session },
        )
        await fixture.bulk.bulkWrite(
          [
            {
              insertOne: {
                document: { key: "three", score: 5, group: "first" },
              },
            },
          ],
          { session },
        )

        expect(
          await fixture.read.findById(created.id, undefined, { session }),
        ).toMatchObject({ score: 2 })
        expect(
          await fixture.read.findOne({ key: "two" }, undefined, { session }),
        ).toMatchObject({ score: 4 })
        expect(
          await fixture.read.findMany({}, undefined, { session }),
        ).toHaveLength(3)
        await expect(
          fixture.read.checkIsExists({ key: "three" }, { session }),
        ).resolves.toBe(true)
        const page = await fixture.pagination.findManyPaginated(
          {},
          undefined,
          { session },
          { limit: 10 },
        )
        expect(page.total).toBe(3)
        expect(page.items[0]).toMatchObject({ key: "three" })
        await expect(
          fixture.aggregation.aggregate([{ $count: "total" }], { session }),
        ).resolves.toEqual([{ total: 3 }])
        expect(await fixture.model.countDocuments()).toBe(0)
        return created.id
      })

      expect(await fixture.model.findById(result)).toMatchObject({ score: 2 })
      expect(await fixture.model.countDocuments()).toBe(3)
    })

    it("откатывает несколько записей и передаёт исходную ошибку", async () => {
      const document = await fixture.model.create({ key: "existing", score: 1 })
      const error = new Error("rollback")

      await expect(
        service.run(async (session) => {
          await fixture.write.updateByFilter(
            { key: "existing" },
            { $set: { score: 9 } },
            { session },
          )
          await fixture.bulk.createMany([{ key: "new", score: 2 }], { session })
          throw error
        }),
      ).rejects.toBe(error)

      expect(await fixture.model.findById(document._id)).toMatchObject({
        score: 1,
      })
      expect(await fixture.model.countDocuments()).toBe(1)
    })

    it("откатывает удаления через все методы репозиториев", async () => {
      const first = await fixture.model.create({ key: "one", score: 1 })
      await fixture.model.create([
        { key: "two", score: 2 },
        { key: "three", score: 3 },
      ])
      const error = new Error("rollback deletes")

      await expect(
        service.run(async (session) => {
          await fixture.write.deleteById(first.id, { session })
          await fixture.write.deleteByFilter({ key: "two" }, { session })
          await fixture.bulk.deleteMany({ key: "three" }, { session })
          expect(
            await fixture.read.findMany({}, undefined, { session }),
          ).toEqual([])
          throw error
        }),
      ).rejects.toBe(error)

      expect(await fixture.model.countDocuments()).toBe(3)
    })
  })
} else {
  describe("MongoTransactionService", () => {
    const createManagedTransaction = () => {
      const state = { isActive: false }
      const endSession = jest.fn<() => Promise<void>>().mockResolvedValue()
      const session = {
        inTransaction: () => state.isActive,
        endSession,
        withTransaction: async (callback: () => Promise<unknown>) => {
          state.isActive = true
          const result = await callback()
          state.isActive = false
          return result
        },
      }
      const service = new MongoTransactionService({
        startSession: async () => session,
      } as unknown as Connection)
      return { service, session, state, endSession }
    }

    it("вызывает отложенные действия только после commit и сохраняет порядок", async () => {
      const { service, state } = createManagedTransaction()
      const calls: number[] = []

      await service.run(async (session) => {
        await service.afterCommit(async () => {
          expect(state.isActive).toBe(false)
          calls.push(1)
        }, session)
        await service.afterCommit(async () => {
          calls.push(2)
        }, session)
        expect(calls).toEqual([])
      })

      expect(calls).toEqual([1, 2])
    })

    it.each(["callback", "commit"])(
      "не публикует действия при ошибке %s после их регистрации",
      async (source) => {
        const { service, session, state, endSession } =
          createManagedTransaction()
        const publish = jest.fn<() => Promise<void>>().mockResolvedValue()
        if (source === "commit") {
          session.withTransaction = async (callback) => {
            state.isActive = true
            await callback()
            state.isActive = false
            throw new Error("commit")
          }
        }

        await expect(
          service.run(async (session) => {
            await service.afterCommit(publish, session)
            if (source === "callback") {
              throw new Error("rollback")
            }
          }),
        ).rejects.toThrow(source === "commit" ? "commit" : "rollback")

        expect(publish).not.toHaveBeenCalled()
        expect(endSession).toHaveBeenCalledTimes(1)
      },
    )

    it("публикует только действия последней попытки транзакции", async () => {
      const { service, session, state } = createManagedTransaction()
      const published: number[] = []
      let attempt = 0
      session.withTransaction = async (callback) => {
        state.isActive = true
        await callback()
        expect(published).toEqual([])
        const result = await callback()
        state.isActive = false
        return result
      }

      await service.run(async (session) => {
        attempt += 1
        const value = attempt
        await service.afterCommit(async () => {
          published.push(value)
        }, session)
      })

      expect(attempt).toBe(2)
      expect(published).toEqual([2])
    })

    it("не публикует действия при ручном abort внутри управляемой транзакции", async () => {
      const { service, state } = createManagedTransaction()
      const publish = jest.fn<() => Promise<void>>().mockResolvedValue()

      await expect(
        service.run(async (session) => {
          await service.afterCommit(publish, session)
          state.isActive = false
        }),
      ).rejects.toThrow("finalized by MongoTransactionService.run")
      expect(publish).not.toHaveBeenCalled()
    })

    it("передаёт ошибку публикации после commit и закрывает session", async () => {
      const { service, state, endSession } = createManagedTransaction()
      const error = new Error("queue unavailable")

      await expect(
        service.run(async (session) => {
          await service.afterCommit(async () => {
            expect(state.isActive).toBe(false)
            throw error
          }, session)
        }),
      ).rejects.toBe(error)
      expect(endSession).toHaveBeenCalledTimes(1)
    })

    it("выполняет действие сразу без транзакции и отклоняет чужую активную session", async () => {
      const { service } = createManagedTransaction()
      const publish = jest.fn<() => Promise<void>>().mockResolvedValue()
      await service.afterCommit(publish)
      expect(publish).toHaveBeenCalledTimes(1)

      await expect(
        service.afterCommit(publish, {
          inTransaction: () => true,
        } as unknown as ClientSession),
      ).rejects.toThrow("MongoTransactionService.run")
      expect(publish).toHaveBeenCalledTimes(1)
    })

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
      expect(withTransaction).toHaveBeenCalledWith(
        expect.any(Function),
        options,
      )
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
}
