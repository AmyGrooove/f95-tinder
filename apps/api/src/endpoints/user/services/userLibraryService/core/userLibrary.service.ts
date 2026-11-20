import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common"
import { Types } from "mongoose"

import { AuthService } from "@endpoints/auth/services/authService"
import { EItemType } from "@entities/item/schemas/EItemType"
import { ELanguage } from "@entities/shared/schemas/ELanguage"
import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { UserRepository } from "@entities/user/services/userRepository"
import { ESort } from "@entities/shared/types/ESort"
import { UserItemRepository } from "@entities/userItem/services/userItemRepository"
import { USER_ITEM_LIBRARY_STATUSES } from "@entities/userItem/static/USER_ITEM_LIBRARY_STATUSES"
import { CursorService } from "@infrastructure/cache/services/cursorService"
import { ESortDirection } from "@entities/shared/types/ESortDirection"
import { filterSingleValues } from "@entities/shared/functions/filterSingleValues"
import { isInt } from "@shared/functions/checks/isInt"
import { isNil } from "@shared/functions/checks/isNil"
import { isNonNegativeSafe } from "@shared/functions/checks/isNonNegativeSafe"
import { isUndefined } from "@shared/functions/checks/isUndefined"
import { requestContext } from "@shared/functions/context/requestContext"

import type { UserLibraryBodyDto } from "../dto/userLibrary.body"
import type { UserLibraryResponseDto } from "../dto/userLibrary.response"

interface IReadUserLibraryProps {
  id: Types.ObjectId
  body: UserLibraryBodyDto
  accessToken: unknown
}

@Injectable()
class UserLibraryService {
  constructor(
    private readonly authService: AuthService,
    private readonly userRepository: UserRepository,
    private readonly userItemRepository: UserItemRepository,
    private readonly cursorService: CursorService,
  ) {}

  async readPage(
    props: IReadUserLibraryProps,
  ): Promise<UserLibraryResponseDto> {
    const { id, body, accessToken } = props
    const { cursor, limit = 20, search, sort = ESort.UPDATED_AT } = body
    const isFavorite = body.isFavorite === true
    const isTitleSort = sort === ESort.TITLE

    if (!isTitleSort && !isUndefined(body.language)) {
      throw new BadRequestException(DICTIONARY.user.library.sortLanguage)
    }

    const isAscending = isUndefined(body.direction)
      ? isTitleSort
      : body.direction === ESortDirection.ASC
    const direction = isAscending ? 1 : -1
    const language = body.language ?? ELanguage.RUSSIAN
    const statuses = filterSingleValues(
      USER_ITEM_LIBRARY_STATUSES,
      body.statuses,
    ).sort()
    const types = [...(body.types ?? Object.values(EItemType))].sort()
    const ownerId = id.toHexString()
    const owner = await this.userRepository.read.findById(ownerId, { _id: 1 })

    if (isNil(owner)) {
      throw new NotFoundException(DICTIONARY.user.library.notFound)
    }

    const isOwner = await this.checkIsOwner(ownerId, accessToken)

    if (isOwner) {
      requestContext.set("userId", ownerId)
    }

    const scope = [
      "userLibrary",
      ownerId,
      isOwner,
      statuses,
      types,
      search ?? null,
      isFavorite,
      sort,
      direction,
      language,
      limit,
    ]
    const offset = isUndefined(cursor)
      ? 0
      : this.cursorService.read({
          cursor,
          scope,
          invalidCursorMessage: DICTIONARY.user.library.invalidCursor,
          isPosition: (value): value is number =>
            isInt(value) &&
            isNonNegativeSafe(value) &&
            value >= limit &&
            value <= Number.MAX_SAFE_INTEGER - limit &&
            value % limit === 0,
        })

    const entries = await this.userItemRepository.readLibraryPage({
      userId: owner._id,
      statuses,
      types,
      isFavorite: isFavorite || undefined,
      search,
      sort,
      direction,
      language,
      offset,
      limit,
      isProgressVisible: isOwner,
    })
    const items = entries.slice(0, limit).map((entry) => ({
      id: entry.item._id.toHexString(),
      type: entry.item.type,
      title: {
        ru: entry.item.title.ru ?? null,
        en: entry.item.title.en ?? null,
      },
      media: entry.item.media.map(({ type, src, language }) => ({
        type,
        src,
        language: language ?? null,
      })),
      status: entry.status,
      isFavorite: entry.isFavorite,
      rating: entry.rating ?? null,
      ratingAverage: entry.ratingAverage,
      userItemId: isOwner ? entry._id.toHexString() : null,
      progress: isOwner ? entry.progress : null,
    }))
    const nextCursor =
      entries.length > limit
        ? this.cursorService.create({ scope, position: offset + limit })
        : null

    return { items, nextCursor }
  }

  private async checkIsOwner(ownerId: string, accessToken: unknown) {
    if (isUndefined(accessToken)) {
      return false
    }

    try {
      const payload = await this.authService.verifyAccessToken(accessToken)

      if (ownerId !== new Types.ObjectId(payload.sub).toHexString()) {
        return false
      }

      const session = await this.authService.getSession(payload)

      return !isNil(session)
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        return false
      }

      throw error
    }
  }
}

export { UserLibraryService }
