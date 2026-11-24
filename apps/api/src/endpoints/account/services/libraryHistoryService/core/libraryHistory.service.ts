import { Injectable, UnauthorizedException } from "@nestjs/common"
import { Types } from "mongoose"

import { AuthService } from "@endpoints/auth/services/authService"
import { mapMediaSources } from "@endpoints/shared/functions/mapMediaSources"
import { ItemRepository } from "@entities/item/services/itemRepository"
import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { UserRepository } from "@entities/user/services/userRepository"
import { EUserActivityType } from "@entities/userActivity/schemas/EUserActivityType"
import type { TUserLibraryActivityType } from "@entities/userActivity/schemas/EUserActivityType"
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

import type { LibraryHistoryBodyDto } from "../dto/libraryHistory.body"
import { ELibraryHistoryEvent } from "../dto/libraryHistory.response"
import type { LibraryHistoryResponseDto } from "../dto/libraryHistory.response"

const HISTORY_TYPES: Record<TUserLibraryActivityType, ELibraryHistoryEvent> = {
  [EUserActivityType.LIBRARY_ITEM_ADDED]: ELibraryHistoryEvent.ADDED,
  [EUserActivityType.LIBRARY_STATUS_CHANGED]:
    ELibraryHistoryEvent.STATUS_CHANGED,
  [EUserActivityType.LIBRARY_RATING_CHANGED]:
    ELibraryHistoryEvent.RATING_CHANGED,
  [EUserActivityType.LIBRARY_FAVORITE_CHANGED]:
    ELibraryHistoryEvent.FAVORITE_CHANGED,
}

@Injectable()
class LibraryHistoryService {
  constructor(
    private readonly authService: AuthService,
    private readonly userRepository: UserRepository,
    private readonly cursorService: CursorService,
    private readonly itemRepository: ItemRepository,
    private readonly storageService: StorageService,
    private readonly activityRepository: UserActivityRepository,
  ) {}

  async readPage(
    accessToken: unknown,
    props: LibraryHistoryBodyDto,
  ): Promise<LibraryHistoryResponseDto> {
    const { cursor, limit = 20 } = props

    const payload = await this.authService.verifyAccessToken(accessToken)
    const [session, user] = await Promise.all([
      this.authService.getSession(payload),
      this.userRepository.read.findById(payload.sub, { _id: 1 }),
    ])

    if (isNil(session) || isNil(user)) {
      throw new UnauthorizedException(DICTIONARY.auth.unauthorized)
    }

    const userId = user._id.toHexString()
    requestContext.set("userId", userId)

    const scope = ["accountLibraryHistory", userId, limit]
    const after = this.readPosition(cursor, scope)
    const entries = await this.activityRepository.readLibraryPage({
      userId: user._id,
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

        return {
          id: _id.toHexString(),
          itemId,
          item: cardsById.get(itemId) ?? null,
          createdAt: createdAt.toISOString(),
          type: HISTORY_TYPES[type],
          ...("status" in eventPayload && { status: eventPayload.status }),
          ...("rating" in eventPayload && { rating: eventPayload.rating }),
          ...("isFavorite" in eventPayload && {
            isFavorite: eventPayload.isFavorite,
          }),
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

export { LibraryHistoryService }
