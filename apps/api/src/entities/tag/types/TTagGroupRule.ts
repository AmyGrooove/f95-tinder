import type { EItemType } from "@entities/item/schemas/EItemType"
import type { EUnit } from "@entities/shared/schemas/EUnit"

interface ITagGroupRuleBase {
  itemTypes: readonly EItemType[]
  cardinality: "one" | "many"
  isUsedForTaste: boolean
  isApprovalRequired: true
  description: string
}

interface ITagGroupValue {
  key: string
  value: string | number | boolean
}

interface ITagGroupRange {
  key: string
  from: number
  to: number | null
}

type TTagGroupRule = ITagGroupRuleBase &
  (
    | {
        kind: "dictionary"
        values?: readonly string[]
      }
    | {
        kind: "enum"
        values: readonly ITagGroupValue[]
        sourceField?: "ageRestriction"
      }
    | {
        kind: "integer"
        min: number
        max: number
        sourceField: "releaseDate"
        isYearWithoutDateAllowed: true
      }
    | {
        kind: "range"
        sourceField:
          | "movie.duration"
          | "series.episodeDuration"
          | "series.episodeCount"
          | "game.mainStoryDuration"
          | "game.fullCompletionDuration"
        unit: EUnit.MINUTE | EUnit.EPISODE
        bounds: "[)"
        ranges: readonly ITagGroupRange[]
        isDefinedEndRequired?: true
      }
  )

export type { TTagGroupRule }
