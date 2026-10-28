import { ELanguage } from "@entities/shared/schemas/ELanguage"
import { EItemField } from "../schemas/EItemField"
import { EItemFieldValueType } from "../schemas/EItemFieldValueType"
import { EUnit } from "@entities/shared/schemas/EUnit"
import type { LanguageText } from "@entities/shared/schemas/languageText.schema"

const ITEM_FIELD_DEFINITIONS = {
  [EItemField.RELEASE_DATE]: {
    valueType: EItemFieldValueType.DATE,
    unit: null,
    name: {
      [ELanguage.RUSSIAN]: "Дата выпуска",
      [ELanguage.ENGLISH]: "Release date",
    },
  },
  [EItemField.AGE_RESTRICTION]: {
    valueType: EItemFieldValueType.NUMBER,
    unit: null,
    name: {
      [ELanguage.RUSSIAN]: "Возрастное ограничение",
      [ELanguage.ENGLISH]: "Age restriction",
    },
  },
  [EItemField.DURATION]: {
    valueType: EItemFieldValueType.NUMBER,
    unit: EUnit.MINUTE,
    name: {
      [ELanguage.RUSSIAN]: "Продолжительность",
      [ELanguage.ENGLISH]: "Duration",
    },
  },
  [EItemField.EPISODE_COUNT]: {
    valueType: EItemFieldValueType.NUMBER,
    unit: EUnit.EPISODE,
    name: {
      [ELanguage.RUSSIAN]: "Количество серий",
      [ELanguage.ENGLISH]: "Episode count",
    },
  },
  [EItemField.RELEASED_EPISODE_COUNT]: {
    valueType: EItemFieldValueType.NUMBER,
    unit: EUnit.EPISODE,
    name: {
      [ELanguage.RUSSIAN]: "Вышедшие серии",
      [ELanguage.ENGLISH]: "Released episode count",
    },
  },
  [EItemField.EPISODE_DURATION]: {
    valueType: EItemFieldValueType.NUMBER,
    unit: EUnit.MINUTE,
    name: {
      [ELanguage.RUSSIAN]: "Продолжительность серии",
      [ELanguage.ENGLISH]: "Episode duration",
    },
  },
  [EItemField.NEXT_EPISODE_AT]: {
    valueType: EItemFieldValueType.DATE,
    unit: null,
    name: {
      [ELanguage.RUSSIAN]: "Следующая серия",
      [ELanguage.ENGLISH]: "Next episode",
    },
  },
  [EItemField.MAIN_STORY_DURATION]: {
    valueType: EItemFieldValueType.NUMBER,
    unit: EUnit.MINUTE,
    name: {
      [ELanguage.RUSSIAN]: "Время основной истории",
      [ELanguage.ENGLISH]: "Main story duration",
    },
  },
  [EItemField.FULL_COMPLETION_DURATION]: {
    valueType: EItemFieldValueType.NUMBER,
    unit: EUnit.MINUTE,
    name: {
      [ELanguage.RUSSIAN]: "Время полного прохождения",
      [ELanguage.ENGLISH]: "Full completion duration",
    },
  },
} satisfies Record<
  EItemField,
  { valueType: EItemFieldValueType; unit: EUnit | null; name: LanguageText }
>

export { ITEM_FIELD_DEFINITIONS }
