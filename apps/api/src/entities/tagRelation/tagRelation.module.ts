import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"

import { TagRelation, TagRelationSchema } from "./schemas/tagRelation.schema"
import { TagRelationRepository } from "./services/tagRelation.repository"

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TagRelation.name, schema: TagRelationSchema },
    ]),
  ],
  providers: [TagRelationRepository],
  exports: [TagRelationRepository],
})
class TagRelationModule {}

export { TagRelationModule }
