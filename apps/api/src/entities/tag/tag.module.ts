import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"

import { DatabaseModule } from "@infrastructure/database/database.module"

import { Tag, TagSchema } from "./schemas/tag.schema"
import { TagRepository } from "./services/tag.repository"

@Module({
  imports: [
    DatabaseModule,
    MongooseModule.forFeature([{ name: Tag.name, schema: TagSchema }]),
  ],
  providers: [TagRepository],
  exports: [TagRepository],
})
class TagModule {}

export { TagModule }
