import { Injectable } from "@nestjs/common"
import type { ClientSession, Types } from "mongoose"

import { MongoTransactionService } from "@infrastructure/database/services/mongoTransaction.service"

@Injectable()
class TagItemEventsService {
  private readonly listeners = new Set<
    (itemIds: Types.ObjectId[]) => Promise<void>
  >()

  constructor(private readonly transactionService: MongoTransactionService) {}

  subscribe(listener: (itemIds: Types.ObjectId[]) => Promise<void>) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async publishChanged(
    itemIds: Types.ObjectId[],
    session?: ClientSession | null,
  ) {
    const uniqueIds = [
      ...new Map(itemIds.map((id) => [String(id), id])).values(),
    ]

    if (uniqueIds.length === 0) {
      return
    }

    await this.transactionService.afterCommit(async () => {
      for (const listener of this.listeners) {
        await listener(uniqueIds)
      }
    }, session)
  }
}

export { TagItemEventsService }
