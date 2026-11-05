import { Module } from "@nestjs/common"

import { ItemModule } from "@entities/item/item.module"

import { ItemController } from "@endpoints/item/controllers/itemController"
import { ItemService } from "@endpoints/item/services/itemService"

@Module({
  imports: [ItemModule],
  controllers: [ItemController],
  providers: [ItemService],
})
class ItemEndpointModule {}

export { ItemEndpointModule }
