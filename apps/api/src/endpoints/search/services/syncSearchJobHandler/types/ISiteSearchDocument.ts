import type { ELanguage } from "@entities/shared/schemas/ELanguage"
import type { EItemType } from "@entities/item/schemas/EItemType"
import type { ECollectionType } from "@entities/collection/schemas/ECollectionType"
import type { LanguageText } from "@entities/shared/schemas/languageText.schema"
import type { MediaSrc } from "@entities/shared/schemas/mediaSrc.schema"

interface IItemSearchDocument {
  id: string
  type: EItemType
  title: LanguageText
  aliases: string[]
  description: LanguageText
  media: Omit<MediaSrc, "source">[]
  tagIds: string[]
  countryTagIds: string[]
  releaseStatusTagIds: string[]
  fields: Record<string, number | null>
  rating: number | null
  ratingScore: number | null
  ratingsCount: number
  hasRating: number
  releaseDate: number | null
  releaseYear: number | null
  hasReleaseDate: number
  latestReleaseDate: number | null
  sortTitle: Record<ELanguage, string>
}

interface IUserSearchDocument {
  id: string
  username: string
  displayName: string
  sortUsername: string
  sortDisplayName: string
}

interface ICollectionSearchDocument {
  id: string
  type: ECollectionType
  title: LanguageText
  description: LanguageText
  media: Omit<MediaSrc, "source">[]
  authorId: string | null
  tagGroup: string
  updatedAt: number
  ratingAverage: number | null
  hasRating: number
  sortTitle: Record<ELanguage, string>
}

type TSiteSearchDocument =
  IItemSearchDocument | IUserSearchDocument | ICollectionSearchDocument

export type {
  IItemSearchDocument,
  IUserSearchDocument,
  ICollectionSearchDocument,
  TSiteSearchDocument,
}
