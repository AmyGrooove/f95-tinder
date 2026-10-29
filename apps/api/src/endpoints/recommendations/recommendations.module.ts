import { Module } from "@nestjs/common"

import { CollectionModule } from "@entities/collection/collection.module"
import { ItemModule } from "@entities/item/item.module"
import { SiteStatsModule } from "@entities/siteStats/siteStats.module"
import { UserTasteProfileModule } from "@entities/userTasteProfile/userTasteProfile.module"

import { RecommendationsService } from "./services/recommendations.service"

@Module({
  imports: [
    CollectionModule,
    ItemModule,
    SiteStatsModule,
    UserTasteProfileModule,
  ],
  providers: [RecommendationsService],
  exports: [RecommendationsService],
})
class RecommendationsModule {}

export { RecommendationsModule }
