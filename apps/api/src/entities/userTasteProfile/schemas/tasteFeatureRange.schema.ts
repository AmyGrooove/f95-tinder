import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { isFiniteNumber } from "@shared/functions/checks/isFiniteNumber"

@Schema({ _id: false, id: false, timestamps: false })
class TasteFeatureRange {
  @Prop({ type: Number, required: true, validate: isFiniteNumber })
  from: number

  @Prop({ type: Number, required: true, validate: isFiniteNumber })
  to: number
}

const TasteFeatureRangeSchema = SchemaFactory.createForClass(TasteFeatureRange)

export { TasteFeatureRange, TasteFeatureRangeSchema }
