import { Module } from "@nestjs/common"

import { CollectionModule } from "@entities/collection/collection.module"

import { CollectionController } from "./controllers/collection.controller"
import { CollectionService } from "./services/collection.service"

@Module({
  imports: [CollectionModule],
  controllers: [CollectionController],
  providers: [CollectionService],
})
class CollectionEndpointModule {}

export { CollectionEndpointModule }
