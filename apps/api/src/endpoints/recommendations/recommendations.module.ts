import { Module } from "@nestjs/common"

import { AuthModule } from "@endpoints/auth/auth.module"
import { ItemModule } from "@entities/item/item.module"
import { ItemRelationModule } from "@entities/itemRelation/itemRelation.module"
import { RecommendationModelModule } from "@entities/recommendationModel/recommendationModel.module"
import { RelationModule } from "@entities/relation/relation.module"
import { SiteStatsModule } from "@entities/siteStats/siteStats.module"
import { UserModule } from "@entities/user/user.module"
import { UserItemModule } from "@entities/userItem/userItem.module"
import { CacheModule } from "@infrastructure/cache/cache.module"

import { FallbackRecommendationsService } from "./services/fallbackRecommendationsService"
import { RecommendationCandidatesService } from "./services/recommendationCandidatesService"
import { RecommendationFeedService } from "./services/recommendationFeedService"
import { RecommendationsService } from "./services/recommendationsService"

@Module({
  imports: [
    AuthModule,
    UserModule,
    ItemModule,
    SiteStatsModule,
    CacheModule,
    RecommendationModelModule,
    UserItemModule,
    ItemRelationModule,
    RelationModule,
  ],
  providers: [
    RecommendationCandidatesService,
    FallbackRecommendationsService,
    RecommendationsService,
    RecommendationFeedService,
  ],
  exports: [RecommendationsService, RecommendationFeedService],
})
class RecommendationsModule {}

export { RecommendationsModule }
