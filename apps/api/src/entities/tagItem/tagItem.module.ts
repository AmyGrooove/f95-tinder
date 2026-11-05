import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"
import { DatabaseModule } from "@infrastructure/database/database.module"

import { TagItem, TagItemSchema } from "./schemas/tagItem.schema"
import { TagItemRepository } from "@entities/tagItem/services/tagItemRepository"
import { TagItemEventsService } from "@entities/tagItem/services/tagItemEventsService"
import { TagItemMutationService } from "@entities/tagItem/services/tagItemMutationService"

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
