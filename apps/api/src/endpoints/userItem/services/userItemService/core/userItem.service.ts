import { TagItemRepository } from "@entities/tagItem/services/tagItemRepository"
import { ETagGroup } from "@entities/tag/schemas/ETagGroup"
import { ETagKey } from "@entities/tag/schemas/ETagKey"
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common"
import { mongo, Types } from "mongoose"
import type { ClientSession, HydratedDocument } from "mongoose"

import { AuthService } from "@endpoints/auth/services/authService"
import { ItemRepository } from "@entities/item/services/itemRepository"
import { EItemType } from "@entities/item/schemas/EItemType"
import { UserRepository } from "@entities/user/services/userRepository"
import { UserItemRepository } from "@entities/userItem/services/userItemRepository"
import { EUserItemStatus } from "@entities/userItem/schemas/EUserItemStatus"
import type { ItemAttempt } from "@entities/userItem/schemas/itemAttempt.schema"
import type { UserItem } from "@entities/userItem/schemas/userItem.schema"
import { USER_ITEM_LIBRARY_STATUSES } from "@entities/userItem/static/USER_ITEM_LIBRARY_STATUSES"
import { EUserItemHistoryEvent } from "@entities/userItemHistory/schemas/EUserItemHistoryEvent"
import {
  UserItemHistoryRepository,
  type TUserItemHistoryEvent,
} from "@entities/userItemHistory/services/userItemHistoryRepository"
import { EUnit } from "@entities/shared/schemas/EUnit"
import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { MongoTransactionService } from "@infrastructure/database/services/mongoTransactionService"
import { isDate } from "@shared/functions/checks/isDate"
import { isNil } from "@shared/functions/checks/isNil"
import { isUndefined } from "@shared/functions/checks/isUndefined"
import { requestContext } from "@shared/functions/context/requestContext"

import type { CreateUserItemBodyDto } from "../dto/createUserItem.body"
import type { CreateExclusionBodyDto } from "../dto/createExclusion.body"
import type { ItemUserResponseDto } from "../dto/itemUser.response"
import type { UserItemResponseDto } from "../dto/userItem.response"
import type { ICreateAttemptProps } from "../types/ICreateAttemptProps"
import type { IUpdateAttemptProps } from "../types/IUpdateAttemptProps"
import type { IUpdateUserItemProps } from "../types/IUpdateUserItemProps"
import type { IMutateUserItemProps } from "../types/IMutateUserItemProps"
import type { IValidateCompletionProps } from "../types/IValidateCompletionProps"
import { USER_ITEM_SKIP_DURATION_MS } from "../static/USER_ITEM_SKIP_DURATION_MS"
import { UserItemStatsService } from "@endpoints/userItem/services/userItemStatsService"

@Injectable()
class UserItemService {
  constructor(
    private readonly authService: AuthService,
    private readonly userRepository: UserRepository,
    private readonly itemRepository: ItemRepository,
    private readonly userItemRepository: UserItemRepository,
    private readonly transactionService: MongoTransactionService,
    private readonly tagItemRepository: TagItemRepository,
    private readonly userItemStatsService: UserItemStatsService,
    private readonly historyRepository: UserItemHistoryRepository,
  ) {}

  async readByItemId(
    accessToken: unknown,
    itemId: Types.ObjectId,
  ): Promise<ItemUserResponseDto> {
    const userId = await this.authenticate(accessToken)
    const isAvailable = await this.itemRepository.read.checkIsExists({
      _id: itemId,
      deletedAt: null,
    })

    if (!isAvailable) {
      throw new NotFoundException(DICTIONARY.item.notFound)
    }

    const userItem = await this.userItemRepository.read.findOne(
      { user: userId, item: itemId, ...this.createCurrentEntryFilter() },
      { _id: 1, status: 1, rating: 1, isFavorite: 1, note: 1, attempts: 1 },
    )

    return {
      entry: isNil(userItem)
        ? null
        : {
            userItemId: userItem._id.toHexString(),
            ...this.mapEntry(userItem),
          },
    }
  }

  async create(accessToken: unknown, body: CreateUserItemBodyDto) {
    return this.createWithStatus(accessToken, body)
  }

  async skip(accessToken: unknown, body: CreateExclusionBodyDto) {
    return this.createWithStatus(accessToken, {
      ...body,
      status: EUserItemStatus.SKIPPED,
    })
  }

  async block(accessToken: unknown, body: CreateExclusionBodyDto) {
    return this.createWithStatus(accessToken, {
      ...body,
      status: EUserItemStatus.BLOCKED,
    })
  }

  private async createWithStatus(
    accessToken: unknown,
    body: CreateUserItemBodyDto,
  ) {
    const userId = await this.authenticate(accessToken)
    const itemId = new Types.ObjectId(body.itemId)
    const isAvailable = await this.itemRepository.read.checkIsExists({
      _id: itemId,
      deletedAt: null,
    })

    if (!isAvailable) {
      throw new NotFoundException(DICTIONARY.userItem.itemNotFound)
    }

    if (body.status === EUserItemStatus.COMPLETED) {
      await this.validateCompletion({ itemId, isCompletionRequested: true })
    }

    try {
      const userItem = await this.runMutation(async (session) => {
        await this.userItemRepository.write.deleteByFilter(
          {
            user: userId,
            item: itemId,
            status: EUserItemStatus.SKIPPED,
            expiresAt: { $lte: new Date() },
          },
          { session },
        )

        const created = await this.userItemRepository.write.create(
          {
            user: userId,
            item: itemId,
            status: body.status,
            expiresAt:
              body.status === EUserItemStatus.SKIPPED
                ? new Date(Date.now() + USER_ITEM_SKIP_DURATION_MS)
                : null,
            attempts: this.checkRequiresAttempt(body.status)
              ? [this.createStatusAttempt(body.status)]
              : [],
          },
          { session },
        )
        await this.userItemStatsService.update({
          itemId,
          previous: null,
          next: this.userItemStatsService.getState(created),
          session,
        })

        if (
          USER_ITEM_LIBRARY_STATUSES.some((status) => status === created.status)
        ) {
          await this.historyRepository.append(
            [
              {
                user: userId,
                item: itemId,
                type: EUserItemHistoryEvent.ADDED,
                status: created.status,
              },
            ],
            session,
          )
        }

        return created
      })

      return this.mapResponse(userItem)
    } catch (error) {
      if (
        error instanceof mongo.MongoServerError &&
        error.code === 11000 &&
        error.keyPattern?.user === 1 &&
        error.keyPattern?.item === 1
      ) {
        throw new ConflictException(DICTIONARY.userItem.alreadyAdded)
      }

      throw error
    }
  }

  async update(accessToken: unknown, props: IUpdateUserItemProps) {
    const { body, id } = props
    const { isCompletedAndUnratedRequired, ...changes } = body

    this.requireChanges(changes)

    return this.mutate(accessToken, {
      id,
      isCompletedAndUnratedRequired,
      mutate: async (userItem, session) => {
        const { status, rating, isFavorite, note } = changes

        if (status === EUserItemStatus.COMPLETED) {
          await this.validateCompletion({
            itemId: userItem.item,
            isCompletionRequested: true,
            session,
          })
        }

        if (!isNil(status)) {
          this.changeStatus(userItem, status)
        }

        if (!isUndefined(rating)) {
          userItem.rating = rating
        }

        if (!isNil(isFavorite)) {
          userItem.isFavorite = isFavorite
        }

        if (!isUndefined(note)) {
          userItem.note = note
        }
      },
    })
  }

  async remove(accessToken: unknown, id: Types.ObjectId) {
    const userId = await this.authenticate(accessToken)
    await this.runMutation(async (session) => {
      const removed = await this.userItemRepository.write.deleteByFilter(
        { _id: id, user: userId },
        { session },
      )

      if (isNil(removed)) {
        throw new NotFoundException(DICTIONARY.userItem.notFound)
      }

      await this.userItemStatsService.update({
        itemId: removed.item,
        previous: this.userItemStatsService.getState(removed),
        next: null,
        session,
      })
    })
  }

  async createAttempt(accessToken: unknown, props: ICreateAttemptProps) {
    const { id, body } = props

    return this.mutate(accessToken, {
      id,
      mutate: async (userItem, session) => {
        if (!this.checkRequiresAttempt(userItem.status)) {
          throw new ConflictException(DICTIONARY.userItem.attemptNotAllowed)
        }

        const attempt: ItemAttempt = {
          id: new Types.ObjectId(),
          isCompleted: body.isCompleted ?? false,
          progress: body.progress ?? null,
          unit: body.unit ?? EUnit.MINUTE,
          startedAt: this.parseDate(body.startedAt),
          completedAt: this.parseDate(body.completedAt),
        }

        if (attempt.isCompleted || attempt.unit === EUnit.PERCENT) {
          await this.validateCompletion({
            itemId: userItem.item,
            isCompletionRequested: attempt.isCompleted,
            session,
          })
        }

        userItem.attempts.push(attempt)
      },
    })
  }

  async updateAttempt(accessToken: unknown, props: IUpdateAttemptProps) {
    const { body, id, attemptId } = props

    this.requireChanges(body)

    return this.mutate(accessToken, {
      id,
      mutate: async (userItem, session) => {
        const attempt = userItem.attempts.find((entry) =>
          entry.id.equals(attemptId),
        )

        if (isNil(attempt)) {
          throw new NotFoundException(DICTIONARY.userItem.attemptNotFound)
        }

        const { isCompleted, progress, unit, startedAt, completedAt } = body

        if (
          isCompleted === true ||
          unit === EUnit.PERCENT ||
          (!isNil(progress) && (unit ?? attempt.unit) === EUnit.PERCENT)
        ) {
          await this.validateCompletion({
            itemId: userItem.item,
            isCompletionRequested: isCompleted === true,
            session,
          })
        }

        if (!isUndefined(isCompleted)) {
          attempt.isCompleted = isCompleted
        }

        if (!isUndefined(progress)) {
          attempt.progress = progress
        }

        if (!isNil(unit)) {
          attempt.unit = unit
        }

        if (!isUndefined(startedAt)) {
          attempt.startedAt = this.parseDate(startedAt)
        }

        if (!isUndefined(completedAt)) {
          attempt.completedAt = this.parseDate(completedAt)
        }
      },
    })
  }

  private async authenticate(accessToken: unknown) {
    const payload = await this.authService.verifyAccessToken(accessToken)
    const [session, user] = await Promise.all([
      this.authService.getSession(payload),
      this.userRepository.read.findById(payload.sub, { _id: 1 }),
    ])

    if (isNil(session) || isNil(user)) {
      throw new UnauthorizedException(DICTIONARY.auth.unauthorized)
    }

    requestContext.set("userId", payload.sub)

    return user._id
  }

  private async mutate(accessToken: unknown, props: IMutateUserItemProps) {
    const { id, mutate, isCompletedAndUnratedRequired = false } = props

    const userId = await this.authenticate(accessToken)

    const result = await this.runMutation(async (session) => {
      const filter = {
        _id: id,
        user: userId,
        ...this.createCurrentEntryFilter(),
      }
      const userItem = await this.userItemRepository.read.findOne(
        filter,
        undefined,
        { session },
      )

      if (isNil(userItem)) {
        throw new NotFoundException(DICTIONARY.userItem.notFound)
      }

      if (
        isCompletedAndUnratedRequired &&
        (userItem.status !== EUserItemStatus.COMPLETED ||
          !isNil(userItem.rating))
      ) {
        throw new ConflictException(DICTIONARY.userItem.ratingCandidateConflict)
      }

      const previous = this.userItemStatsService.getState(userItem)

      await mutate(userItem, session)
      this.validateUserItem(userItem)

      if (userItem.attempts.some((attempt) => attempt.unit === EUnit.EPISODE)) {
        const isSeason = await this.itemRepository.read.checkIsExists(
          {
            _id: userItem.item,
            type: {
              $in: [
                EItemType.SERIES,
                EItemType.ANIMATED_SERIES,
                EItemType.ANIME_SERIES,
              ],
            },
          },
          { session },
        )

        if (!isSeason) {
          throw new BadRequestException(DICTIONARY.userItem.invalidEpisodeUnit)
        }
      }

      const updated = await this.userItemRepository.write.updateByFilter(
        isCompletedAndUnratedRequired
          ? { ...filter, status: EUserItemStatus.COMPLETED, rating: null }
          : filter,
        {
          $set: {
            status: userItem.status,
            expiresAt: userItem.expiresAt,
            rating: userItem.rating,
            isFavorite: userItem.isFavorite,
            note: userItem.note,
            attempts: userItem.attempts,
          },
        },
        { session },
      )

      if (isNil(updated)) {
        if (isCompletedAndUnratedRequired) {
          throw new ConflictException(
            DICTIONARY.userItem.ratingCandidateConflict,
          )
        }

        throw new NotFoundException(DICTIONARY.userItem.notFound)
      }

      const next = this.userItemStatsService.getState(updated)
      await this.userItemStatsService.update({
        itemId: updated.item,
        previous,
        next,
        session,
      })

      const event = { user: userId, item: updated.item }
      const events: TUserItemHistoryEvent[] = []

      if (previous.status !== next.status) {
        events.push({
          ...event,
          type: EUserItemHistoryEvent.STATUS_CHANGED,
          status: next.status,
        })
      }

      const rating = next.rating ?? null

      if ((previous.rating ?? null) !== rating) {
        events.push({
          ...event,
          type: EUserItemHistoryEvent.RATING_CHANGED,
          rating,
        })
      }

      const isFavorite = next.isFavorite === true

      if ((previous.isFavorite === true) !== isFavorite) {
        events.push({
          ...event,
          type: EUserItemHistoryEvent.FAVORITE_CHANGED,
          isFavorite,
        })
      }

      await this.historyRepository.append(events, session)

      return this.mapResponse(updated)
    })

    return result
  }

  private createCurrentEntryFilter() {
    return {
      $or: [
        { status: { $ne: EUserItemStatus.SKIPPED } },
        { expiresAt: { $gt: new Date() } },
      ],
    }
  }

  private async runMutation<TResult>(
    mutate: (session: ClientSession) => Promise<TResult>,
  ): Promise<TResult> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.transactionService.run(mutate)
      } catch (error) {
        const isMetricCreationConflict =
          error instanceof mongo.MongoServerError &&
          error.code === 11000 &&
          ((error.keyPattern?.item === 1 && error.keyPattern?.user !== 1) ||
            error.keyPattern?.key === 1)

        if (!isMetricCreationConflict || attempt >= 2) {
          throw error
        }
      }
    }
  }

  private async validateCompletion(props: IValidateCompletionProps) {
    const { itemId, isCompletionRequested, session } = props
    const item = await this.itemRepository.read.findOne(
      { _id: itemId },
      { type: 1 },
      { session },
    )

    if (isNil(item)) {
      return
    }

    const isGame = item.type === EItemType.GAME
    const isSeasonCompletion =
      isCompletionRequested &&
      (item.type === EItemType.SERIES ||
        item.type === EItemType.ANIMATED_SERIES ||
        item.type === EItemType.ANIME_SERIES)

    if (!isGame && !isSeasonCompletion) {
      return
    }

    const isCompletionUnavailable =
      await this.tagItemRepository.checkHasTagKeys(
        {
          itemId,
          group: isGame ? ETagGroup.HAS_DEFINED_END : ETagGroup.RELEASE_STATUS,
          keys: isGame
            ? [ETagKey.HAS_DEFINED_END_FALSE]
            : [
                ETagKey.RELEASE_STATUS_ANNOUNCED,
                ETagKey.RELEASE_STATUS_ONGOING,
              ],
        },
        { session },
      )

    if (isCompletionUnavailable) {
      throw new ConflictException(
        isGame
          ? DICTIONARY.userItem.gameHasNoDefinedEnd
          : DICTIONARY.userItem.seasonReleaseNotFinished,
      )
    }
  }

  private changeStatus(userItem: UserItem, status: EUserItemStatus) {
    if (this.checkRequiresAttempt(status) && userItem.attempts.length === 0) {
      userItem.attempts.push(this.createStatusAttempt(status))
    }

    const attempt = userItem.attempts.at(-1)

    if (status === EUserItemStatus.COMPLETED && !isNil(attempt)) {
      attempt.isCompleted = true
    }

    if (status !== EUserItemStatus.SKIPPED) {
      userItem.expiresAt = null
    } else if (userItem.status !== EUserItemStatus.SKIPPED) {
      userItem.expiresAt = new Date(Date.now() + USER_ITEM_SKIP_DURATION_MS)
    }

    userItem.status = status
  }

  private createStatusAttempt(status: EUserItemStatus): ItemAttempt {
    return {
      id: new Types.ObjectId(),
      isCompleted: status === EUserItemStatus.COMPLETED,
      progress: null,
      unit: EUnit.MINUTE,
      startedAt: null,
      completedAt: null,
    }
  }

  private checkRequiresAttempt(status: EUserItemStatus) {
    return (
      status === EUserItemStatus.IN_PROGRESS ||
      status === EUserItemStatus.ON_HOLD ||
      status === EUserItemStatus.COMPLETED ||
      status === EUserItemStatus.DROPPED
    )
  }

  private validateUserItem(userItem: UserItem) {
    if (
      userItem.status === EUserItemStatus.SKIPPED &&
      (!isNil(userItem.rating) ||
        userItem.isFavorite ||
        !isNil(userItem.note) ||
        userItem.attempts.length > 0)
    ) {
      throw new ConflictException(DICTIONARY.userItem.skipHasPersonalData)
    }

    if (
      this.checkRequiresAttempt(userItem.status) &&
      userItem.attempts.length === 0
    ) {
      throw new ConflictException(DICTIONARY.userItem.attemptRequired)
    }

    for (const attempt of userItem.attempts) {
      if (
        !isNil(attempt.startedAt) &&
        !isNil(attempt.completedAt) &&
        attempt.completedAt < attempt.startedAt
      ) {
        throw new BadRequestException(DICTIONARY.userItem.invalidDates)
      }

      if (
        attempt.unit === EUnit.PERCENT &&
        !isNil(attempt.progress) &&
        attempt.progress > 100
      ) {
        throw new BadRequestException(DICTIONARY.userItem.invalidPercent)
      }
    }
  }

  private parseDate(value: string | null | undefined) {
    if (isNil(value)) {
      return null
    }

    const date = new Date(value)

    if (!isDate(date)) {
      throw new BadRequestException(DICTIONARY.userItem.invalidDate)
    }

    return date
  }

  private requireChanges(body: object) {
    if (Object.values(body).every(isUndefined)) {
      throw new BadRequestException(DICTIONARY.userItem.emptyUpdate)
    }
  }

  private mapResponse(
    userItem: HydratedDocument<UserItem>,
  ): UserItemResponseDto {
    return {
      id: userItem._id.toHexString(),
      itemId: userItem.item.toHexString(),
      expiresAt: userItem.expiresAt?.toISOString() ?? null,
      ...this.mapEntry(userItem),
      createdAt: userItem.createdAt.toISOString(),
      updatedAt: userItem.updatedAt.toISOString(),
    }
  }

  private mapEntry(userItem: UserItem) {
    return {
      status: userItem.status,
      rating: userItem.rating,
      isFavorite: userItem.isFavorite,
      note: userItem.note,
      attempts: userItem.attempts.map((attempt) => ({
        id: attempt.id.toHexString(),
        isCompleted: attempt.isCompleted,
        progress: attempt.progress,
        unit: attempt.unit,
        startedAt: attempt.startedAt?.toISOString() ?? null,
        completedAt: attempt.completedAt?.toISOString() ?? null,
      })),
    }
  }
}

export { UserItemService }
