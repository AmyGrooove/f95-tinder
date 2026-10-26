import type { EItemField } from "@entities/item/schemas/EItemField"
import type { EItemFieldValueType } from "@entities/item/schemas/EItemFieldValueType"

type TCollectionFieldFilter = { field: EItemField } & (
  | { valueType: EItemFieldValueType.NUMBER; min?: number; max?: number }
  | { valueType: EItemFieldValueType.DATE; min?: Date; max?: Date }
)

export type { TCollectionFieldFilter }
