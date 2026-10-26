import { EItemField } from "../schemas/EItemField"
import { EItemFieldValueType } from "../schemas/EItemFieldValueType"
import { EUnit } from "@entities/shared/schemas/EUnit"
import type { LanguageText } from "@entities/shared/schemas/languageText.schema"

const ITEM_FIELD_DEFINITIONS = {
  [EItemField.RELEASE_DATE]: {
    valueType: EItemFieldValueType.DATE,
    unit: null,
    name: { ru: "Дата выпуска", en: "Release date" },
  },
  [EItemField.AGE_RESTRICTION]: {
    valueType: EItemFieldValueType.NUMBER,
    unit: null,
    name: { ru: "Возрастное ограничение", en: "Age restriction" },
  },
  [EItemField.DURATION]: {
    valueType: EItemFieldValueType.NUMBER,
    unit: EUnit.MINUTE,
    name: { ru: "Продолжительность", en: "Duration" },
  },
  [EItemField.EPISODE_COUNT]: {
    valueType: EItemFieldValueType.NUMBER,
    unit: EUnit.EPISODE,
    name: { ru: "Количество серий", en: "Episode count" },
  },
  [EItemField.RELEASED_EPISODE_COUNT]: {
    valueType: EItemFieldValueType.NUMBER,
    unit: EUnit.EPISODE,
    name: { ru: "Вышедшие серии", en: "Released episode count" },
  },
  [EItemField.EPISODE_DURATION]: {
    valueType: EItemFieldValueType.NUMBER,
    unit: EUnit.MINUTE,
    name: { ru: "Продолжительность серии", en: "Episode duration" },
  },
  [EItemField.NEXT_EPISODE_AT]: {
    valueType: EItemFieldValueType.DATE,
    unit: null,
    name: { ru: "Следующая серия", en: "Next episode" },
  },
  [EItemField.MAIN_STORY_DURATION]: {
    valueType: EItemFieldValueType.NUMBER,
    unit: EUnit.MINUTE,
    name: { ru: "Время основной истории", en: "Main story duration" },
  },
  [EItemField.FULL_COMPLETION_DURATION]: {
    valueType: EItemFieldValueType.NUMBER,
    unit: EUnit.MINUTE,
    name: { ru: "Время полного прохождения", en: "Full completion duration" },
  },
} satisfies Record<
  EItemField,
  { valueType: EItemFieldValueType; unit: EUnit | null; name: LanguageText }
>

export { ITEM_FIELD_DEFINITIONS }
