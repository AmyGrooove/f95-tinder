import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"

import { Relation, RelationSchema } from "./schemas/relation.schema"
import { RelationRepository } from "./services/relation.repository"

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Relation.name, schema: RelationSchema },
    ]),
  ],
  providers: [RelationRepository],
  exports: [RelationRepository],
})
class RelationModule {}

export { RelationModule }
