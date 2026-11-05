import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"

import { Tag, TagSchema } from "./schemas/tag.schema"
import { TagRepository } from "@entities/tag/services/tagRepository"

@Module({
  imports: [MongooseModule.forFeature([{ name: Tag.name, schema: TagSchema }])],
  providers: [TagRepository],
  exports: [TagRepository],
})
class TagModule {}

export { TagModule }
