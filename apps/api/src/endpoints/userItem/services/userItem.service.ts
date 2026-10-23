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
import { isNil } from "@shared/functions/checks/isNil"
import { isUndefined } from "@shared/functions/checks/isUndefined"
import { requestContext } from "@shared/functions/context/requestContext"

import type { CreateUserItemBodyDto } from "../dto/body/createUserItem.body"
import type { UserItemResponseDto } from "../dto/response/userItem.response"
import type { ICreateAttemptProps } from "../types/ICreateAttemptProps"
import type { IUpdateAttemptProps } from "../types/IUpdateAttemptProps"
import type { IUpdateUserItemProps } from "../types/IUpdateUserItemProps"
import type { IMutateUserItemProps } from "../types/IMutateUserItemProps"

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
    const userId = await this.authenticate(accessToken)
    const itemId = new Types.ObjectId(body.itemId)
    const isAvailable = await this.itemRepository.read.checkIsExists({
      _id: itemId,
      deletedAt: null,
    })

    if (!isAvailable) {
      throw new NotFoundException(DICTIONARY.userItem.itemNotFound)
    }

    try {
      const userItem = await this.userItemRepository.write.create({
        user: userId,
        item: itemId,
        status: body.status,
        attempts:
          body.status === EUserItemStatus.PLANNED
            ? []
            : [this.createStatusAttempt(body.status)],
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
        const isActive = this.checkIsActive(body.status)
        const attempt: ItemAttempt = {
          id: new Types.ObjectId(),
          status: body.status,
          progress: body.progress ?? null,
          unit: body.unit ?? EUnit.MINUTE,
          startedAt:
            isUndefined(body.startedAt) && isActive
              ? new Date()
              : this.parseDate(body.startedAt),
          completedAt: this.parseDate(body.completedAt),
        }

        userItem.attempts.push(attempt)

        if (isActive) {
          userItem.status = attempt.status
        }
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

        const isPreviouslyActive = this.checkIsActive(attempt.status)
        const { status, progress, unit, startedAt, completedAt } = props.body

        if (!isNil(status)) {
          attempt.status = status

          if (this.checkIsActive(status)) {
            attempt.completedAt = null
          } else if (isPreviouslyActive && isUndefined(completedAt)) {
            attempt.completedAt = new Date()
          }
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

        if (isPreviouslyActive || this.checkIsActive(attempt.status)) {
          userItem.status = attempt.status
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

    return new Types.ObjectId(payload.sub)
  }

  private async mutate(accessToken: unknown, props: IMutateUserItemProps) {
    const userId = await this.authenticate(accessToken)

    return this.transactionService.run(async (session) => {
      const filter = { _id: props.id, user: userId }
      const userItem = await this.userItemRepository.read.findOne(
        filter,
        undefined,
        { session },
      )

      if (isNil(userItem)) {
        throw new NotFoundException(DICTIONARY.userItem.notFound)
      }

      props.mutate(userItem)
      this.validateAttempts(userItem.attempts)

      const updated = await this.userItemRepository.write.updateByFilter(
        filter,
        {
          $set: {
            status: userItem.status,
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
    if (userItem.status === status) {
      return
    }

    const attempt = userItem.attempts.find((entry) =>
      this.checkIsActive(entry.status),
    )

    if (status === EUserItemStatus.PLANNED) {
      if (!isNil(attempt)) {
        throw new ConflictException(DICTIONARY.userItem.activeAttemptPlanned)
      }
    } else if (!isNil(attempt)) {
      attempt.status = status
      attempt.completedAt = this.checkIsActive(status) ? null : new Date()
    } else {
      userItem.attempts.push(this.createStatusAttempt(status))
    }

    userItem.status = status
  }

  private createStatusAttempt(
    status: Exclude<EUserItemStatus, EUserItemStatus.PLANNED>,
  ): ItemAttempt {
    const isActive = this.checkIsActive(status)

    return {
      id: new Types.ObjectId(),
      status,
      progress: null,
      unit: EUnit.MINUTE,
      startedAt: isActive ? new Date() : null,
      completedAt: isActive ? null : new Date(),
    }
  }

  private checkIsActive(status: EUserItemStatus) {
    return (
      status === EUserItemStatus.IN_PROGRESS ||
      status === EUserItemStatus.ON_HOLD
    )
  }

  private validateAttempts(attempts: ItemAttempt[]) {
    if (
      attempts.filter((entry) => this.checkIsActive(entry.status)).length > 1
    ) {
      throw new ConflictException(DICTIONARY.userItem.activeAttemptExists)
    }

    for (const attempt of attempts) {
      if (
        !isNil(attempt.startedAt) &&
        !isNil(attempt.completedAt) &&
        attempt.completedAt < attempt.startedAt
      ) {
        throw new BadRequestException(DICTIONARY.userItem.invalidDates)
      }

      if (this.checkIsActive(attempt.status) && !isNil(attempt.completedAt)) {
        throw new BadRequestException(
          DICTIONARY.userItem.activeAttemptCompletedAt,
        )
      }
    }
  }

  private parseDate(value: string | null | undefined) {
    if (isNil(value)) {
      return null
    }

    const date = new Date(value)

    if (!Number.isFinite(date.getTime())) {
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
      rating: userItem.rating,
      isFavorite: userItem.isFavorite,
      note: userItem.note,
      attempts: userItem.attempts.map((attempt) => ({
        id: attempt.id.toHexString(),
        status: attempt.status,
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
