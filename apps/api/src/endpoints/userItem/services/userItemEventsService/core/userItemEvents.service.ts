import { Injectable } from "@nestjs/common"
import type { ClientSession } from "mongoose"

import { MongoTransactionService } from "@infrastructure/database/services/mongoTransactionService"

import type { IUserItemChange } from "../types/IUserItemChange"

type TUserItemChangeListener = (
  change: IUserItemChange,
  session: ClientSession,
) => Promise<void>

@Injectable()
class UserItemEventsService {
  private readonly listeners = new Set<TUserItemChangeListener>()

  constructor(private readonly transactionService: MongoTransactionService) {}

  subscribe(listener: TUserItemChangeListener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async publishChanged(change: IUserItemChange, session: ClientSession) {
    this.transactionService.assertManagedSession(session)

    for (const listener of this.listeners) {
      await listener(change, session)
    }
  }
}

export { UserItemEventsService }
