import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common"
import { mongo, Types } from "mongoose"
import type { HydratedDocument } from "mongoose"

import { AuthService } from "@endpoints/auth/services/auth.service"
import { ItemRepository } from "@entities/item/services/item.repository"
import { UserRepository } from "@entities/user/services/user.repository"
import { UserItemRepository } from "@entities/userItem/services/userItem.repository"
import { EUserItemStatus } from "@entities/userItem/schemas/EUserItemStatus"
import type { ItemAttempt } from "@entities/userItem/schemas/itemAttempt.schema"
import type { UserItem } from "@entities/userItem/schemas/userItem.schema"
import { EUnit } from "@entities/shared/schemas/EUnit"
import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { MongoTransactionService } from "@infrastructure/database/services/mongoTransaction.service"
import { isDate } from "@shared/functions/checks/isDate"
import { isNil } from "@shared/functions/checks/isNil"
import { isUndefined } from "@shared/functions/checks/isUndefined"
import { requestContext } from "@shared/functions/context/requestContext"

import type { CreateUserItemBodyDto } from "../dto/body/createUserItem.body"
import type { CreateExclusionBodyDto } from "../dto/body/createExclusion.body"
import type { UserItemResponseDto } from "../dto/response/userItem.response"
import type { ICreateAttemptProps } from "../types/ICreateAttemptProps"
import type { IUpdateAttemptProps } from "../types/IUpdateAttemptProps"
import type { IUpdateUserItemProps } from "../types/IUpdateUserItemProps"
import type { IMutateUserItemProps } from "../types/IMutateUserItemProps"
import { USER_ITEM_SKIP_DURATION_MS } from "../static/USER_ITEM_SKIP_DURATION_MS"

@Injectable()
class UserItemService {
  constructor(
    private readonly authService: AuthService,
    private readonly userRepository: UserRepository,
    private readonly itemRepository: ItemRepository,
    private readonly userItemRepository: UserItemRepository,
    private readonly transactionService: MongoTransactionService,
  ) {}

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

    await this.userItemRepository.write.deleteByFilter({
      user: userId,
      item: itemId,
      status: EUserItemStatus.SKIPPED,
      expiresAt: { $lte: new Date() },
    })

    try {
      const userItem = await this.userItemRepository.write.create({
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
    this.requireChanges(props.body)

    return this.mutate(accessToken, {
      id: props.id,
      mutate: (userItem) => {
        const { status, rating, isFavorite, note } = props.body

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
    const userItem = await this.userItemRepository.write.deleteByFilter({
      _id: id,
      user: userId,
    })

    if (isNil(userItem)) {
      throw new NotFoundException(DICTIONARY.userItem.notFound)
    }
  }

  async createAttempt(accessToken: unknown, props: ICreateAttemptProps) {
    return this.mutate(accessToken, {
      id: props.id,
      mutate: (userItem) => {
        const { body } = props
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

        userItem.attempts.push(attempt)
      },
    })
  }

  async updateAttempt(accessToken: unknown, props: IUpdateAttemptProps) {
    this.requireChanges(props.body)

    return this.mutate(accessToken, {
      id: props.id,
      mutate: (userItem) => {
        const attempt = userItem.attempts.find((entry) =>
          entry.id.equals(props.attemptId),
        )

        if (isNil(attempt)) {
          throw new NotFoundException(DICTIONARY.userItem.attemptNotFound)
        }

        const { isCompleted, progress, unit, startedAt, completedAt } =
          props.body

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
    const userId = await this.authenticate(accessToken)

    return this.transactionService.run(async (session) => {
      const filter = {
        _id: props.id,
        user: userId,
        $or: [
          { status: { $ne: EUserItemStatus.SKIPPED } },
          { expiresAt: { $gt: new Date() } },
        ],
      }
      const userItem = await this.userItemRepository.read.findOne(
        filter,
        undefined,
        { session },
      )

      if (isNil(userItem)) {
        throw new NotFoundException(DICTIONARY.userItem.notFound)
      }

      props.mutate(userItem)
      this.validateUserItem(userItem)

      const updated = await this.userItemRepository.write.updateByFilter(
        filter,
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
        throw new NotFoundException(DICTIONARY.userItem.notFound)
      }

      return this.mapResponse(updated)
    })
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
      status: userItem.status,
      expiresAt: userItem.expiresAt?.toISOString() ?? null,
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
      createdAt: userItem.createdAt.toISOString(),
      updatedAt: userItem.updatedAt.toISOString(),
    }
  }
}

export { UserItemService }
