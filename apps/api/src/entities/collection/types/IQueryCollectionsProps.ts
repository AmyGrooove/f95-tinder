import type { TPageSize } from "@infrastructure/database/types/TPageSize"

import type { Types } from "mongoose"

import type { ECollectionType } from "../schemas/ECollectionType"

interface IQueryCollectionsProps {
  page: number
  limit: TPageSize

  itemIds?: Types.ObjectId[]
  type?: ECollectionType
}

export type { IQueryCollectionsProps }
