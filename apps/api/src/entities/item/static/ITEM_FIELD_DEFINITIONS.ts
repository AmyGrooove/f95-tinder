import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { EItemField } from "../schemas/EItemField"
import { EItemFieldValueType } from "../schemas/EItemFieldValueType"
import { EUnit } from "@entities/shared/schemas/EUnit"
import type { LanguageText } from "@entities/shared/schemas/languageText.schema"

const ITEM_FIELD_DEFINITIONS = {
  [EItemField.RELEASE_DATE]: {
    valueType: EItemFieldValueType.DATE,
    unit: null,
    name: DICTIONARY.itemFieldNames.releaseDate,
  },
  [EItemField.AGE_RESTRICTION]: {
    valueType: EItemFieldValueType.NUMBER,
    unit: null,
    name: DICTIONARY.itemFieldNames.ageRestriction,
  },
  [EItemField.DURATION]: {
    valueType: EItemFieldValueType.NUMBER,
    unit: EUnit.MINUTE,
    name: DICTIONARY.itemFieldNames.duration,
  },
  [EItemField.EPISODE_COUNT]: {
    valueType: EItemFieldValueType.NUMBER,
    unit: EUnit.EPISODE,
    name: DICTIONARY.itemFieldNames.episodeCount,
  },
  [EItemField.RELEASED_EPISODE_COUNT]: {
    valueType: EItemFieldValueType.NUMBER,
    unit: EUnit.EPISODE,
    name: DICTIONARY.itemFieldNames.releasedEpisodeCount,
  },
  [EItemField.EPISODE_DURATION]: {
    valueType: EItemFieldValueType.NUMBER,
    unit: EUnit.MINUTE,
    name: DICTIONARY.itemFieldNames.episodeDuration,
  },
  [EItemField.NEXT_EPISODE_AT]: {
    valueType: EItemFieldValueType.DATE,
    unit: null,
    name: DICTIONARY.itemFieldNames.nextEpisodeAt,
  },
  [EItemField.MAIN_STORY_DURATION]: {
    valueType: EItemFieldValueType.NUMBER,
    unit: EUnit.MINUTE,
    name: DICTIONARY.itemFieldNames.mainStoryDuration,
  },
  [EItemField.FULL_COMPLETION_DURATION]: {
    valueType: EItemFieldValueType.NUMBER,
    unit: EUnit.MINUTE,
    name: DICTIONARY.itemFieldNames.fullCompletionDuration,
  },
} satisfies Record<
  EItemField,
  { valueType: EItemFieldValueType; unit: EUnit | null; name: LanguageText }
>

export { ITEM_FIELD_DEFINITIONS }
