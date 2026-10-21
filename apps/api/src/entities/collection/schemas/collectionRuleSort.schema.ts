import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"

import type { TCreateEntity } from "@infrastructure/database/types/TCreateEntity"
import { ECollectionSortField } from "./ECollectionSortField"
import { ECollectionSortDirection } from "./ECollectionSortDirection"

@Schema({ _id: false, id: false, timestamps: false })
class CollectionRuleSort {
  @Prop({
    type: String,
    enum: Object.values(ECollectionSortField),
    required: true,
    default: ECollectionSortField.CREATED_AT,
  })
  field: ECollectionSortField

  @Prop({
    type: String,
    enum: Object.values(ECollectionSortDirection),
    required: true,
    default: ECollectionSortDirection.DESC,
  })
  direction: ECollectionSortDirection
}

type TCreateCollectionRuleSort = TCreateEntity<
  CollectionRuleSort,
  "field" | "direction"
>

const CollectionRuleSortSchema =
  SchemaFactory.createForClass(CollectionRuleSort)

export { CollectionRuleSort, CollectionRuleSortSchema }
export type { TCreateCollectionRuleSort }
