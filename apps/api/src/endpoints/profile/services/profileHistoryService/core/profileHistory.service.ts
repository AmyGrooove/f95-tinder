import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common"
import { Types } from "mongoose"

import { AuthService } from "@endpoints/auth/services/authService"
import { mapMediaSources } from "@endpoints/shared/functions/mapMediaSources"
import { ItemRepository } from "@entities/item/services/itemRepository"
import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { UserRepository } from "@entities/user/services/userRepository"
import { EUserActivityType } from "@entities/userActivity/schemas/EUserActivityType"
import { UserActivityRepository } from "@entities/userActivity/services/userActivityRepository"
import { CursorService } from "@infrastructure/cache/services/cursorService"
import { StorageService } from "@infrastructure/storage/services/storageService"
import { isArray } from "@shared/functions/checks/isArray"
import { isDate } from "@shared/functions/checks/isDate"
import { isInt } from "@shared/functions/checks/isInt"
import { isNil } from "@shared/functions/checks/isNil"
import { isString } from "@shared/functions/checks/isString"
import { isUndefined } from "@shared/functions/checks/isUndefined"
import { requestContext } from "@shared/functions/context/requestContext"
import { REGEX } from "@shared/static/REGEX"

import type { ProfileHistoryBodyDto } from "../dto/profileHistory.body"
import { EProfileHistoryEvent } from "../dto/profileHistory.response"
import type { ProfileHistoryResponseDto } from "../dto/profileHistory.response"

interface IReadProfileHistoryProps {
  accessToken: unknown
  profileUserId: Types.ObjectId
  body: ProfileHistoryBodyDto
}

@Injectable()
class ProfileHistoryService {
  constructor(
    private readonly authService: AuthService,
    private readonly userRepository: UserRepository,
    private readonly cursorService: CursorService,
    private readonly itemRepository: ItemRepository,
    private readonly storageService: StorageService,
    private readonly activityRepository: UserActivityRepository,
  ) {}

  async readPage({
    accessToken,
    profileUserId,
    body: { cursor, limit = 20 },
  }: IReadProfileHistoryProps): Promise<ProfileHistoryResponseDto> {
    const payload = await this.authService.verifyAccessToken(accessToken)
    const [session, viewer] = await Promise.all([
      this.authService.getSession(payload),
      this.userRepository.read.findById(payload.sub, { _id: 1 }),
    ])

    if (isNil(session) || isNil(viewer)) {
      throw new UnauthorizedException(DICTIONARY.auth.unauthorized)
    }

    requestContext.set("userId", viewer._id.toHexString())

    const profileId = profileUserId.toHexString()
    if (!profileUserId.equals(viewer._id)) {
      const profile = await this.userRepository.read.findById(profileId, {
        _id: 1,
      })

      if (isNil(profile)) {
        throw new NotFoundException(DICTIONARY.user.library.notFound)
      }
    }

    const scope = ["accountLibraryHistory", profileId, limit]
    const after = this.readPosition(cursor, scope)
    const entries = await this.activityRepository.readPage({
      userId: profileUserId,
      limit,
      after,
    })
    const page = entries.slice(0, limit)
    const last = page.at(-1)
    const itemIds = new Map(
      page.map(({ payload: { item } }) => [item.toHexString(), item]),
    )
    const cards = await this.itemRepository.readPosterCardsByIds([
      ...itemIds.values(),
    ])
    const cardsById = new Map(
      cards.map((card) => {
        const { _id, title, media } = card

        const [poster] = mapMediaSources(media, this.storageService)

        return [
          _id.toHexString(),
          {
            title: { ru: title?.ru ?? null, en: title?.en ?? null },
            poster: poster ?? null,
          },
        ]
      }),
    )

    return {
      items: page.map(({ _id, createdAt, type, payload: eventPayload }) => {
        const itemId = eventPayload.item.toHexString()

        const event = {
          id: _id.toHexString(),
          itemId,
          item: cardsById.get(itemId) ?? null,
          createdAt: createdAt.toISOString(),
        }

        switch (type) {
          case EUserActivityType.LIBRARY_ITEM_ADDED:
          case EUserActivityType.LIBRARY_STATUS_CHANGED:
            return {
              ...event,
              type:
                type === EUserActivityType.LIBRARY_ITEM_ADDED
                  ? EProfileHistoryEvent.ADDED
                  : EProfileHistoryEvent.STATUS_CHANGED,
              status: eventPayload.status,
            }
          case EUserActivityType.LIBRARY_RATING_CHANGED:
            return {
              ...event,
              type: EProfileHistoryEvent.RATING_CHANGED,
              rating: eventPayload.rating,
            }
          case EUserActivityType.LIBRARY_FAVORITE_CHANGED:
            return {
              ...event,
              type: EProfileHistoryEvent.FAVORITE_CHANGED,
              isFavorite: eventPayload.isFavorite,
            }
        }
      }),
      nextCursor:
        entries.length > limit && !isUndefined(last)
          ? this.cursorService.create({
              scope,
              position: [last.createdAt.getTime(), last._id.toHexString()],
            })
          : null,
    }
  }

  private readPosition(cursor: string | undefined, scope: readonly unknown[]) {
    if (isUndefined(cursor)) {
      return undefined
    }

    const [createdAt, id] = this.cursorService.read({
      cursor,
      scope,
      invalidCursorMessage: DICTIONARY.user.library.invalidCursor,
      isPosition: (value): value is [number, string] =>
        isArray(value) &&
        value.length === 2 &&
        isInt(value[0]) &&
        isDate(new Date(value[0])) &&
        isString(value[1]) &&
        REGEX.MONGO_OBJECT_ID.test(value[1]),
    })

    return { createdAt: new Date(createdAt), id: new Types.ObjectId(id) }
  }
}

export { ProfileHistoryService }
