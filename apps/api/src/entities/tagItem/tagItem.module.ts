import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"
import { DatabaseModule } from "@infrastructure/database/database.module"

import { TagItem, TagItemSchema } from "./schemas/tagItem.schema"
import { TagItemRepository } from "./services/tagItem.repository"
import { TagItemEventsService } from "./services/tagItemEvents.service"
import { TagItemMutationService } from "./services/tagItemMutation.service"

@Module({
  imports: [
    DatabaseModule,
    MongooseModule.forFeature([{ name: TagItem.name, schema: TagItemSchema }]),
  ],
  providers: [TagItemRepository, TagItemEventsService, TagItemMutationService],
  exports: [TagItemRepository, TagItemEventsService],
})
class TagItemModule {}

export { TagItemModule }
