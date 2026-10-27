import { Module } from "@nestjs/common"

import { CollectionModule } from "@entities/collection/collection.module"
import { ItemModule } from "@entities/item/item.module"
import { UserItemModule } from "@entities/userItem/userItem.module"
import { UserTasteProfileModule } from "@entities/userTasteProfile/userTasteProfile.module"

import { RecommendationsService } from "./services/recommendations.service"

@Module({
  imports: [
    CollectionModule,
    ItemModule,
    UserItemModule,
    UserTasteProfileModule,
  ],
  providers: [RecommendationsService],
  exports: [RecommendationsService],
})
class RecommendationsModule {}

export { RecommendationsModule }
