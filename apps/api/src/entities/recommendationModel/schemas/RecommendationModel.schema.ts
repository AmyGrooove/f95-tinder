import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"

import { MongoEntity } from "@infrastructure/database/types/MongoEntity"

import type { RecommendationModelAls } from "./RecommendationModelAls.schema"
import { RecommendationModelAlsSchema } from "./RecommendationModelAls.schema"
import type { RecommendationModelItemCf } from "./RecommendationModelItemCf.schema"
import { RecommendationModelItemCfSchema } from "./RecommendationModelItemCf.schema"

@Schema({ collection: "RecommendationModel" })
class RecommendationModel extends MongoEntity {
  @Prop({ type: Number, required: true })
  formatVersion: number

  @Prop({ type: [String], required: true, default: undefined })
  itemIds: string[]

  @Prop({ type: RecommendationModelItemCfSchema, required: true })
  itemCF: RecommendationModelItemCf

  @Prop({ type: RecommendationModelAlsSchema, required: true })
  als: RecommendationModelAls

  @Prop({ type: Buffer, required: true })
  popularity: Buffer
}

const RecommendationModelSchema =
  SchemaFactory.createForClass(RecommendationModel)

RecommendationModelSchema.index(
  { createdAt: -1, _id: -1 },
  { name: "recommendationModelLatest" },
)

export { RecommendationModel, RecommendationModelSchema }
