import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"

import { SourceItem, SourceItemSchema } from "./schemas/sourceItem.schema"
import { SourceItemRepository } from "./services/sourceItem.repository"

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SourceItem.name, schema: SourceItemSchema },
    ]),
  ],
  providers: [SourceItemRepository],
  exports: [SourceItemRepository],
})
class SourceItemModule {}

export { SourceItemModule }
