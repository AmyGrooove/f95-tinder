import { createHash, randomUUID } from "node:crypto"

import { InjectRedis } from "@nestjs-redis/client"
import { Injectable } from "@nestjs/common"
import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common"
import { Cron } from "@nestjs/schedule"
import { Types } from "mongoose"
import type { ClientSession } from "mongoose"
import type { RedisClientType } from "redis"

import { UserItemEventsService } from "@endpoints/userItem/services/userItemEventsService"
import { EUserActivityType } from "@entities/userActivity/schemas/EUserActivityType"
import type { TCreateUserActivity } from "@entities/userActivity/schemas/userActivity.schema"
import { UserActivityRepository } from "@entities/userActivity/services/userActivityRepository"
import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { USER_ITEM_LIBRARY_STATUSES } from "@entities/userItem/static/USER_ITEM_LIBRARY_STATUSES"
import { InfrastructureConfigService } from "@infrastructure/config/services/configService"
import { MongoTransactionService } from "@infrastructure/database/services/mongoTransactionService"
import { LoggerService } from "@infrastructure/logger/services/loggerService"

import { LIBRARY_ACTIVITY_SCRIPTS } from "../static/LIBRARY_ACTIVITY_SCRIPTS"
import type {
  ILibraryActivityChange,
  ILibraryActivityState,
  IPendingLibraryActivity,
} from "../types/ILibraryActivityChange"

const WINDOW_MS = 5 * 60 * 1000
const LEASE_MS = 60 * 1000
const FLUSH_BATCH_SIZE = 50

const normalizeState = (state: ILibraryActivityState | null) => {
  return state === null
    ? null
    : {
        status: state.status,
        rating: state.rating ?? null,
        isFavorite: state.isFavorite === true,
      }
}

@Injectable()
class LibraryActivityService implements OnModuleInit, OnModuleDestroy {
  readonly #keys: string[]
  private unsubscribe?: () => void

  constructor(
    @InjectRedis("libraryActivity") private readonly redis: RedisClientType,
    private readonly activityRepository: UserActivityRepository,
    private readonly transactionService: MongoTransactionService,
    private readonly logger: LoggerService,
    configuration: InfrastructureConfigService,
    private readonly userItemEventsService: UserItemEventsService,
  ) {
    const prefix = `{${configuration.app.name}:library-activity}`
    this.#keys = [`${prefix}:active`, `${prefix}:windows`, `${prefix}:due`]
  }

  onModuleInit() {
    this.unsubscribe = this.userItemEventsService.subscribe((change, session) =>
      this.stageAfterCommit(change, session),
    )
  }

  onModuleDestroy() {
    this.unsubscribe?.()
  }

  async stageAfterCommit(
    change: ILibraryActivityChange,
    session: ClientSession,
  ) {
    const { user, item } = change
    const before = normalizeState(change.before)
    const after = normalizeState(change.after)
    const isChanged =
      before?.status !== after?.status ||
      before?.rating !== after?.rating ||
      before?.isFavorite !== after?.isFavorite

    if (!isChanged) {
      return
    }

    await this.transactionService.afterCommit(async () => {
      const revision =
        session.operationTime?.toBigInt().toString().padStart(20, "0") ?? ""

      try {
        await this.redis.eval(LIBRARY_ACTIVITY_SCRIPTS.stage, {
          keys: this.#keys,
          arguments: [
            `${user.toHexString()}:${item.toHexString()}`,
            randomUUID(),
            JSON.stringify(before),
            JSON.stringify(after),
            revision,
            String(WINDOW_MS),
          ],
        })
      } catch (error) {
        this.logger.error(DICTIONARY.userActivity.stageFailed, error, {
          context: LibraryActivityService.name,
        })
      }
    }, session)
  }

  @Cron("*/5 * * * * *", { waitForCompletion: true })
  async flushDue() {
    try {
      const records = await this.redis.eval(LIBRARY_ACTIVITY_SCRIPTS.claim, {
        keys: this.#keys,
        arguments: [String(FLUSH_BATCH_SIZE), String(LEASE_MS)],
      })

      if (!Array.isArray(records)) {
        throw new Error(DICTIONARY.userActivity.invalidPendingEvents)
      }

      const results = await Promise.allSettled(
        records.map(async (record: unknown) => {
          if (typeof record !== "string") {
            throw new Error(DICTIONARY.userActivity.invalidPendingEvent)
          }

          await this.flushRecord(record)
        }),
      )
      for (const result of results) {
        if (result.status === "rejected") {
          this.logger.error(
            DICTIONARY.userActivity.flushFailed,
            result.reason,
            {
              context: LibraryActivityService.name,
            },
          )
        }
      }
    } catch (error) {
      this.logger.error(DICTIONARY.userActivity.flushFailed, error, {
        context: LibraryActivityService.name,
      })
    }
  }

  private async flushRecord(record: string) {
    const change: IPendingLibraryActivity = JSON.parse(record)
    await this.activityRepository.appendOnce(this.createEvents(change))
    await this.redis.eval(LIBRARY_ACTIVITY_SCRIPTS.acknowledge, {
      keys: this.#keys,
      arguments: [change.id],
    })
  }

  private createEvents(change: IPendingLibraryActivity): TCreateUserActivity[] {
    const { id, pair, before, after, observedAt } = change
    if (after === null) {
      return []
    }

    const [userId, itemId] = pair.split(":")
    const user = new Types.ObjectId(userId)
    const item = new Types.ObjectId(itemId)
    const createdAt = new Date(observedAt)
    const metadata = (type: EUserActivityType) => ({
      _id: new Types.ObjectId(
        createHash("sha256").update(`${id}:${type}`).digest("hex").slice(0, 24),
      ),
      user,
      createdAt,
      updatedAt: createdAt,
    })
    const events: TCreateUserActivity[] = []

    if (
      before === null &&
      USER_ITEM_LIBRARY_STATUSES.some((status) => status === after.status)
    ) {
      const type = EUserActivityType.LIBRARY_ITEM_ADDED
      events.push({
        ...metadata(type),
        type,
        payload: { item, status: after.status },
      })
    } else if (before !== null && before.status !== after.status) {
      const type = EUserActivityType.LIBRARY_STATUS_CHANGED
      events.push({
        ...metadata(type),
        type,
        payload: { item, status: after.status },
      })
    }

    if ((before?.rating ?? null) !== after.rating) {
      const type = EUserActivityType.LIBRARY_RATING_CHANGED
      events.push({
        ...metadata(type),
        type,
        payload: { item, rating: after.rating },
      })
    }

    if ((before?.isFavorite ?? false) !== after.isFavorite) {
      const type = EUserActivityType.LIBRARY_FAVORITE_CHANGED
      events.push({
        ...metadata(type),
        type,
        payload: { item, isFavorite: after.isFavorite },
      })
    }

    return events
  }
}

export { LibraryActivityService }
