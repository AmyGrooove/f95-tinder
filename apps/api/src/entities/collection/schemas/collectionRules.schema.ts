import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"

import type { TCreateEntity } from "@infrastructure/database/types/TCreateEntity"
import { EItemType } from "@entities/item/schemas/EItemType"
import { isArray } from "@shared/functions/checks/isArray"
import { isInt } from "@shared/functions/checks/isInt"
import { isNil } from "@shared/functions/checks/isNil"
import { isNonNegativeSafe } from "@shared/functions/checks/isNonNegativeSafe"
import type {
  CollectionTagRules,
  TCreateCollectionTagRules,
} from "./collectionTagRules.schema"
import { CollectionTagRulesSchema } from "./collectionTagRules.schema"
import type { CollectionFeatureRule } from "./collectionFeatureRule.schema"
import { CollectionFeatureRuleSchema } from "./collectionFeatureRule.schema"
import type {
  CollectionRuleSort,
  TCreateCollectionRuleSort,
} from "./collectionRuleSort.schema"
import { CollectionRuleSortSchema } from "./collectionRuleSort.schema"

@Schema({ _id: false, id: false, timestamps: false })
class CollectionRules {
  @Prop({
    type: [{ type: String, enum: Object.values(EItemType) }],
    required: true,
    default: [],
    validate: (value: EItemType[]) =>
      isArray(value) &&
      value.every((entry) => !isNil(entry)) &&
      new Set(value).size === value.length,
  })
  itemTypes: EItemType[]

  @Prop({ type: CollectionTagRulesSchema, required: true, default: () => ({}) })
  tags: CollectionTagRules

  @Prop({
    type: [CollectionFeatureRuleSchema],
    required: true,
    default: [],
    validate: (value: unknown) =>
      isArray(value) && value.every((entry) => !isNil(entry)),
  })
  features: CollectionFeatureRule[]

  @Prop({ type: CollectionRuleSortSchema, required: true, default: () => ({}) })
  sort: CollectionRuleSort

  @Prop({
    type: Number,
    default: null,
    validate: (value: unknown) =>
      isNil(value) || (isInt(value) && isNonNegativeSafe(value) && value > 0),
  })
  limit: number | null
}

type TCreateCollectionRules = TCreateEntity<
  CollectionRules,
  "itemTypes" | "features" | "limit",
  {
    tags?: TCreateCollectionTagRules
    sort?: TCreateCollectionRuleSort
  }
>

const CollectionRulesSchema = SchemaFactory.createForClass(CollectionRules)

export { CollectionRules, CollectionRulesSchema }
export type { TCreateCollectionRules }
