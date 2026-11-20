import { Injectable, UnauthorizedException } from "@nestjs/common"
import { Types } from "mongoose"

import { AuthService } from "@endpoints/auth/services/authService"
import { ItemRepository } from "@entities/item/services/itemRepository"
import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { UserRepository } from "@entities/user/services/userRepository"
import { UserItemHistoryRepository } from "@entities/userItemHistory/services/userItemHistoryRepository"
import { CursorService } from "@infrastructure/cache/services/cursorService"
import { isArray } from "@shared/functions/checks/isArray"
import { isDate } from "@shared/functions/checks/isDate"
import { isInt } from "@shared/functions/checks/isInt"
import { isNil } from "@shared/functions/checks/isNil"
import { isString } from "@shared/functions/checks/isString"
import { isUndefined } from "@shared/functions/checks/isUndefined"
import { requestContext } from "@shared/functions/context/requestContext"
import { REGEX } from "@shared/static/REGEX"

import type { LibraryHistoryBodyDto } from "../dto/libraryHistory.body"
import type { LibraryHistoryResponseDto } from "../dto/libraryHistory.response"

@Injectable()
class LibraryHistoryService {
  constructor(
    private readonly authService: AuthService,
    private readonly userRepository: UserRepository,
    private readonly historyRepository: UserItemHistoryRepository,
    private readonly cursorService: CursorService,
    private readonly itemRepository: ItemRepository,
  ) {}

  async readPage(
    accessToken: unknown,
    { cursor, limit = 20 }: LibraryHistoryBodyDto,
  ): Promise<LibraryHistoryResponseDto> {
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
    const entries = await this.historyRepository.readPage({
      userId: user._id,
      limit,
      after,
    })
    const page = entries.slice(0, limit)
    const last = page.at(-1)
    const itemIds = new Map(page.map(({ item }) => [item.toHexString(), item]))
    const cards = await this.itemRepository.readPosterCardsByIds([
      ...itemIds.values(),
    ])
    const cardsById = new Map(
      cards.map(({ _id, title, media }) => {
        const poster = media[0]

        return [
          _id.toHexString(),
          {
            title: { ru: title?.ru ?? null, en: title?.en ?? null },
            poster: isUndefined(poster)
              ? null
              : {
                  src: poster.src,
                  language: poster.language ?? null,
                  type: poster.type,
                },
          },
        ]
      }),
    )

    return {
      items: page.map(
        ({ _id, item, createdAt, type, status, rating, isFavorite }) => ({
          id: _id.toHexString(),
          itemId: item.toHexString(),
          item: cardsById.get(item.toHexString()) ?? null,
          createdAt: createdAt.toISOString(),
          type,
          ...(!isUndefined(status) && { status }),
          ...(!isUndefined(rating) && { rating }),
          ...(!isUndefined(isFavorite) && { isFavorite }),
        }),
      ),
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
