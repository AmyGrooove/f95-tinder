import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"

@Schema({ _id: false, id: false, timestamps: false })
class RecommendationModelItemCf {
  @Prop({ type: Number, required: true })
  maxNeighbors: number

  @Prop({ type: Number, required: true })
  shrink: number

  @Prop({ type: Buffer, required: true })
  offsets: Buffer

  @Prop({ type: Buffer, required: true })
  indices: Buffer

  @Prop({ type: Buffer, required: true })
  weights: Buffer
}

const RecommendationModelItemCfSchema = SchemaFactory.createForClass(
  RecommendationModelItemCf,
)

export { RecommendationModelItemCf, RecommendationModelItemCfSchema }
