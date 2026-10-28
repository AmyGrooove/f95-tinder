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
  media: MediaSrc[]
  tagIds: string[]
  fields: Record<string, number | null>
  rating: number | null
  hasRating: number
  releaseDate: number | null
  hasReleaseDate: number
  sortTitle: { ru: string; en: string }
}

interface IUserSearchDocument {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
  sortUsername: string
  sortDisplayName: string
}

interface ICollectionSearchDocument {
  id: string
  type: ECollectionType
  title: LanguageText
  description: LanguageText
  media: MediaSrc[]
  authorId: string | null
  updatedAt: number
  sortTitle: { ru: string; en: string }
}

type TSiteSearchDocument =
  IItemSearchDocument | IUserSearchDocument | ICollectionSearchDocument

export type {
  IItemSearchDocument,
  IUserSearchDocument,
  ICollectionSearchDocument,
  TSiteSearchDocument,
}
