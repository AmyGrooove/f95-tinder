import { checkIsFeatureValue } from "@entities/shared/functions/checks/checkIsFeatureValue"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { Schema as MongooseSchema } from "mongoose"
import type { Types } from "mongoose"

import { isDate } from "@shared/functions/checks/isDate"
import { isFiniteNumber } from "@shared/functions/checks/isFiniteNumber"
import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { ECollectionFeatureOperator } from "./ECollectionFeatureOperator"

@Schema({ _id: false, id: false, timestamps: false })
class CollectionFeatureRule {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: "Feature" })
  feature: Types.ObjectId

  @Prop({
    type: String,
    enum: Object.values(ECollectionFeatureOperator),
    required: true,
  })
  operator: ECollectionFeatureOperator

  @Prop({
    type: MongooseSchema.Types.Mixed,
    required: true,
    validate: checkIsFeatureValue,
  })
  value: number | string | boolean | Date
}

const CollectionFeatureRuleSchema = SchemaFactory.createForClass(
  CollectionFeatureRule,
)

CollectionFeatureRuleSchema.pre("validate", function () {
  if (
    this.operator !== ECollectionFeatureOperator.EQ &&
    !isFiniteNumber(this.value) &&
    !isDate(this.value)
  ) {
    this.invalidate("value", DICTIONARY.collection.orderedFeatureValue)
  }
})

export { CollectionFeatureRule, CollectionFeatureRuleSchema }
