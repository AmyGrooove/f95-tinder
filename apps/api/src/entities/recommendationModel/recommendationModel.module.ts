import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"

import {
  RecommendationModel,
  RecommendationModelSchema,
} from "./schemas/RecommendationModel.schema"
import { RecommendationModelRepository } from "./services/recommendationModelRepository"

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RecommendationModel.name, schema: RecommendationModelSchema },
    ]),
  ],
  providers: [RecommendationModelRepository],
  exports: [RecommendationModelRepository],
})
class RecommendationModelModule {}

export { RecommendationModelModule }
