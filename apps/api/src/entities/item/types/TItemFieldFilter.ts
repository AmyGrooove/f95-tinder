import type { EItemField } from "../schemas/EItemField"
import type { EItemFieldValueType } from "../schemas/EItemFieldValueType"

type TItemFieldFilter = { field: EItemField } & (
  | { valueType: EItemFieldValueType.NUMBER; min?: number; max?: number }
  | { valueType: EItemFieldValueType.DATE; min?: Date; max?: Date }
)

export type { TItemFieldFilter }
