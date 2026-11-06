import type { LanguageText } from "@entities/shared/schemas/languageText.schema"
import type { ETagGroup } from "@entities/tag/schemas/ETagGroup"

import type { TAG_SEARCH_SETTINGS } from "../static/TAG_SEARCH_SETTINGS"

interface ITagSearchDocument {
  id: string
  key: string
  group: ETagGroup | typeof TAG_SEARCH_SETTINGS.ungrouped
  name: LanguageText
}

export type { ITagSearchDocument }
