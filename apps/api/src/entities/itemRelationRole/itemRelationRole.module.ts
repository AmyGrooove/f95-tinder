import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"

import {
  ItemRelationRole,
  ItemRelationRoleSchema,
} from "./schemas/itemRelationRole.schema"
import { ItemRelationRoleRepository } from "./services/itemRelationRole.repository"

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ItemRelationRole.name, schema: ItemRelationRoleSchema },
    ]),
  ],
  providers: [ItemRelationRoleRepository],
  exports: [ItemRelationRoleRepository],
})
class ItemRelationRoleModule {}

export { ItemRelationRoleModule }
