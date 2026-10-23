import type { Feature } from "@entities/feature/schemas/feature.schema"
import type { EFeatureValueType } from "@entities/feature/schemas/EFeatureValueType"

type TCollectionFeatureOptions = Pick<
  Feature,
  "_id" | "key" | "group" | "name" | "unit"
> &
  (
    | { valueType: EFeatureValueType.NUMBER; min: number; max: number }
    | { valueType: EFeatureValueType.DATE; min: Date; max: Date }
    | { valueType: EFeatureValueType.BOOLEAN; values: boolean[] }
  )

export type { TCollectionFeatureOptions }
