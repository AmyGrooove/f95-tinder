import type { Types } from "mongoose"

import type { EItemType } from "@entities/item/schemas/EItemType"
import type { EMediaType } from "@entities/shared/schemas/EMediaType"
import type { LanguageText } from "@entities/shared/schemas/languageText.schema"
import type { MediaSrc } from "@entities/shared/schemas/mediaSrc.schema"
import type { ICursorPaginationResult } from "@infrastructure/database/types/IPaginationResult"

interface IRecommendationItem {
  _id: Types.ObjectId
  type: EItemType
  title: LanguageText
  media: (MediaSrc & { type: EMediaType.POSTER })[]
}

type TFindRecommendationsResult = ICursorPaginationResult<IRecommendationItem>

export type { TFindRecommendationsResult }
