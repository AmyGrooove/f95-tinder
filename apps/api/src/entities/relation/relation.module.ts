import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"

import { Relation, RelationSchema } from "./schemas/relation.schema"
import { RelationRepository } from "@entities/relation/services/relationRepository"

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
