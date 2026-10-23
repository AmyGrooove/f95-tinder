import type { Types } from "mongoose"

import type { EFeatureValueType } from "@entities/feature/schemas/EFeatureValueType"

type TCollectionFeatureFilter = { featureId: Types.ObjectId } & (
  | { valueType: EFeatureValueType.NUMBER; min?: number; max?: number }
  | { valueType: EFeatureValueType.DATE; min?: Date; max?: Date }
  | { valueType: EFeatureValueType.BOOLEAN; values: boolean[] }
)

export type { TCollectionFeatureFilter }
