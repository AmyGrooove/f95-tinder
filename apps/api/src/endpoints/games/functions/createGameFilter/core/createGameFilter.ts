import { BadRequestException } from "@nestjs/common"
import { Types } from "mongoose"

import { escapeRegex } from "@shared/functions/escapeRegex"
import type { ICreateGameFilterProps } from "../types/ICreateGameFilterProps"
import { isNil } from "@shared/functions/isNil"

const createGameFilter = (
  props: ICreateGameFilterProps,
): Record<string, unknown> => {
  const { query, creatorIds, excludedGameIds } = props
  const filter: Record<string, unknown> = {}
  const andFilters: Record<string, unknown>[] = []

  if (query.search) {
    const search = escapeRegex(query.search.trim())

    if (search.length > 0) {
      andFilters.push({
        $or: [
          { title: { $regex: search, $options: "i" } },
          { creatorId: { $in: creatorIds ?? [] } },
        ],
      })
    }
  }

  if (query.tagIds?.length) {
    filter.tagIds = {
      $all: query.tagIds.map((tagId) => {
        return new Types.ObjectId(tagId)
      }),
    }
  }

  if (query.prefixIds?.length) {
    filter.prefixIds = {
      $all: query.prefixIds.map((prefixId) => {
        return new Types.ObjectId(prefixId)
      }),
    }
  }

  if (query.excludeTagIds?.length) {
    andFilters.push({
      tagIds: {
        $nin: query.excludeTagIds.map((tagId) => {
          return new Types.ObjectId(tagId)
        }),
      },
    })
  }

  if (query.excludePrefixIds?.length) {
    andFilters.push({
      prefixIds: {
        $nin: query.excludePrefixIds.map((prefixId) => {
          return new Types.ObjectId(prefixId)
        }),
      },
    })
  }

  if (query.cursor) {
    try {
      const cursor = JSON.parse(
        Buffer.from(query.cursor, "base64url").toString("utf8"),
      ) as {
        f95UpdatedAt: string | null
        id: string
      }
      const cursorDate = isNil(cursor.f95UpdatedAt)
        ? null
        : new Date(cursor.f95UpdatedAt)

      andFilters.push({
        $or: [
          { f95UpdatedAt: { $lt: cursorDate } },
          {
            f95UpdatedAt: cursorDate,
            _id: { $lt: new Types.ObjectId(cursor.id) },
          },
        ],
      })
    } catch {
      throw new BadRequestException("Cursor is invalid")
    }
  }

  if (excludedGameIds?.length) {
    andFilters.push({ _id: { $nin: excludedGameIds } })
  }

  if (andFilters.length > 0) {
    filter.$and = andFilters
  }

  return filter
}

export { createGameFilter }
