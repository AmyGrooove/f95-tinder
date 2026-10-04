import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"

import {
  UserRecommendationState,
  UserRecommendationStateSchema,
} from "./schemas/userRecommendationState.schema"
import { UserRecommendationStateRepository } from "./services/userRecommendationState.repository"

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: UserRecommendationState.name,
        schema: UserRecommendationStateSchema,
      },
    ]),
  ],
  providers: [UserRecommendationStateRepository],
  exports: [UserRecommendationStateRepository],
})
class UserRecommendationStateModule {}

export { UserRecommendationStateModule }
