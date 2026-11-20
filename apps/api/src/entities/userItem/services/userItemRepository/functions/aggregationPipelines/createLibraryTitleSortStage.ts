import type { PipelineStage } from "mongoose"
import { ELanguage } from "@entities/shared/schemas/ELanguage"

const createLibraryTitleSortStage = (
  language: ELanguage,
): PipelineStage.Set => {
  const title = `$visibleItem.title.${language}`
  const fallbackLanguage =
    language === ELanguage.RUSSIAN ? ELanguage.ENGLISH : ELanguage.RUSSIAN

  return {
    $set: {
      sortTitle: {
        $cond: [
          { $ne: [{ $trim: { input: { $ifNull: [title, ""] } } }, ""] },
          title,
          `$visibleItem.title.${fallbackLanguage}`,
        ],
      },
    },
  }
}

export { createLibraryTitleSortStage }
