import type { Types } from "mongoose"

import type { EMediaType } from "@entities/shared/schemas/EMediaType"
import type { LanguageText } from "@entities/shared/schemas/languageText.schema"
import type { MediaSrc } from "@entities/shared/schemas/mediaSrc.schema"

import type { EItemType } from "../../../schemas/EItemType"

interface IItemPosterCard {
  _id: Types.ObjectId
  type: EItemType
  title: LanguageText
  media: (MediaSrc & { type: EMediaType.POSTER })[]
}

export type { IItemPosterCard }
