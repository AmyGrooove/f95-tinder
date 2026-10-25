import { Module } from "@nestjs/common"

import { ItemModule } from "@entities/item/item.module"

import { ItemController } from "./controllers/item.controller"
import { ItemService } from "./services/item.service"

@Module({
  imports: [ItemModule],
  controllers: [ItemController],
  providers: [ItemService],
})
class ItemEndpointModule {}

export { ItemEndpointModule }
