import { Module } from "@nestjs/common"

import { UserItemEndpointModule } from "@endpoints/userItem/userItem.module"
import { ItemModule } from "@entities/item/item.module"
import { ItemRelationModule } from "@entities/itemRelation/itemRelation.module"
import { ItemStatsModule } from "@entities/itemStats/itemStats.module"
import { RelationModule } from "@entities/relation/relation.module"
import { TagModule } from "@entities/tag/tag.module"
import { TagItemModule } from "@entities/tagItem/tagItem.module"

import { ItemController } from "./controllers/itemController"
import { ItemService } from "./services/itemService"

@Module({
  imports: [
    ItemModule,
    ItemRelationModule,
    ItemStatsModule,
    RelationModule,
    TagModule,
    TagItemModule,
    UserItemEndpointModule,
  ],
  controllers: [ItemController],
  providers: [ItemService],
})
class ItemEndpointModule {}

export { ItemEndpointModule }
