import { Injectable } from "@nestjs/common"
import { InjectConnection } from "@nestjs/mongoose"
import type { ClientSession, Connection } from "mongoose"
import { isNil } from "@shared/functions/checks/isNil"

@Injectable()
class MongoTransactionService {
  private readonly commitCallbacks = new WeakMap<
    ClientSession,
    (() => Promise<void>)[]
  >()

  constructor(@InjectConnection() private readonly connection: Connection) {}

  assertManagedSession(session?: ClientSession | null) {
    if (
      session?.inTransaction() === true &&
      !this.commitCallbacks.has(session)
    ) {
      throw new Error(
        "Transaction callbacks require MongoTransactionService.run",
      )
    }
  }

  async afterCommit(
    callback: () => Promise<void>,
    session?: ClientSession | null,
  ) {
    this.assertManagedSession(session)

    if (!isNil(session) && this.commitCallbacks.has(session)) {
      this.commitCallbacks.get(session)?.push(callback)
      return
    }

    await callback()
  }

  async run<TResult>(
    callback: (session: ClientSession) => Promise<TResult>,
    options?: Parameters<ClientSession["withTransaction"]>[1],
  ): Promise<TResult> {
    const session = await this.connection.startSession()

    try {
      const result = await session.withTransaction(async () => {
        this.commitCallbacks.set(session, [])
        const result = await callback(session)

        if (
          (this.commitCallbacks.get(session)?.length ?? 0) > 0 &&
          !session.inTransaction()
        ) {
          throw new Error(
            "Transactions with after-commit callbacks must be finalized by MongoTransactionService.run",
          )
        }

        return result
      }, options)

      for (const callback of this.commitCallbacks.get(session) ?? []) {
        await callback()
      }

      return result
    } finally {
      this.commitCallbacks.delete(session)
      await session.endSession()
    }
  }
}

export { MongoTransactionService }
