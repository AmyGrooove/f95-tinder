import type { Types } from "mongoose"

import type { ECollectionType } from "../schemas/ECollectionType"

interface IQueryCollectionsProps {
  page: number
  limit: number

  itemIds?: Types.ObjectId[]
  type?: ECollectionType
}

export type { IQueryCollectionsProps }
