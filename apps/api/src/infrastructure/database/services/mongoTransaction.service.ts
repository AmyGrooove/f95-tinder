import { Injectable } from "@nestjs/common"
import { InjectConnection } from "@nestjs/mongoose"
import type { ClientSession, Connection } from "mongoose"

@Injectable()
class MongoTransactionService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  async run<TResult>(
    callback: (session: ClientSession) => Promise<TResult>,
    options?: Parameters<ClientSession["withTransaction"]>[1],
  ): Promise<TResult> {
    const session = await this.connection.startSession()

    try {
      return await session.withTransaction(() => callback(session), options)
    } finally {
      await session.endSession()
    }
  }
}

export { MongoTransactionService }
