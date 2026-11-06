import { Module } from "@nestjs/common"

import { AuthModule } from "@endpoints/auth/auth.module"
import { ItemModule } from "@entities/item/item.module"
import { SiteStatsModule } from "@entities/siteStats/siteStats.module"
import { UserModule } from "@entities/user/user.module"
import { CacheModule } from "@infrastructure/cache/cache.module"

import { FallbackRecommendationsService } from "./services/fallbackRecommendationsService"
import { RecommendationCandidatesService } from "./services/recommendationCandidatesService"
import { RecommendationsService } from "./services/recommendationsService"

@Module({
  imports: [AuthModule, UserModule, ItemModule, SiteStatsModule, CacheModule],
  providers: [
    RecommendationCandidatesService,
    FallbackRecommendationsService,
    RecommendationsService,
  ],
  exports: [RecommendationsService],
})
class RecommendationsModule {}

export { RecommendationsModule }
