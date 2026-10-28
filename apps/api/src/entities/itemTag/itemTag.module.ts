import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"
import { DatabaseModule } from "@infrastructure/database/database.module"

import { ItemTag, ItemTagSchema } from "./schemas/itemTag.schema"
import { ItemTagRepository } from "./services/itemTag.repository"
import { ItemTagEventsService } from "./services/itemTagEvents.service"
import { ItemTagMutationService } from "./services/itemTagMutation.service"

@Module({
  imports: [
    DatabaseModule,
    MongooseModule.forFeature([{ name: ItemTag.name, schema: ItemTagSchema }]),
  ],
  providers: [ItemTagRepository, ItemTagEventsService, ItemTagMutationService],
  exports: [ItemTagRepository, ItemTagEventsService],
})
class ItemTagModule {}

export { ItemTagModule }
