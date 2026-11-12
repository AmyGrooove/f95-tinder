import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"

@Schema({ _id: false, id: false, timestamps: false })
class RecommendationModelAls {
  @Prop({ type: Number, required: true })
  factors: number

  @Prop({ type: Number, required: true })
  alpha: number

  @Prop({ type: Number, required: true })
  regularization: number

  @Prop({ type: Buffer, required: true })
  itemFactors: Buffer
}

const RecommendationModelAlsSchema = SchemaFactory.createForClass(
  RecommendationModelAls,
)

export { RecommendationModelAls, RecommendationModelAlsSchema }
