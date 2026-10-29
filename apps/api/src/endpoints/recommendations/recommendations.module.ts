import { Module } from "@nestjs/common"

import { CollectionModule } from "@entities/collection/collection.module"
import { ItemModule } from "@entities/item/item.module"
import { SiteMetricModule } from "@entities/siteMetric/siteMetric.module"
import { UserTasteProfileModule } from "@entities/userTasteProfile/userTasteProfile.module"

import { RecommendationsService } from "./services/recommendations.service"

@Module({
  imports: [
    CollectionModule,
    ItemModule,
    SiteMetricModule,
    UserTasteProfileModule,
  ],
  providers: [RecommendationsService],
  exports: [RecommendationsService],
})
class RecommendationsModule {}

export { RecommendationsModule }
