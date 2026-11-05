import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"

import { ItemRelation, ItemRelationSchema } from "./schemas/itemRelation.schema"
import { ItemRelationRepository } from "@entities/itemRelation/services/itemRelationRepository"

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ItemRelation.name, schema: ItemRelationSchema },
    ]),
  ],
  providers: [ItemRelationRepository],
  exports: [ItemRelationRepository],
})
class ItemRelationModule {}

export { ItemRelationModule }
