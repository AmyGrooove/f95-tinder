import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"

import { DatabaseModule } from "@infrastructure/database/database.module"

import { Creator, CreatorSchema } from "./schemas/creator.schema"
import { CreatorRepository } from "./services/creator.repository"

@Module({
  imports: [
    DatabaseModule,
    MongooseModule.forFeature([{ name: Creator.name, schema: CreatorSchema }]),
  ],
  providers: [CreatorRepository],
  exports: [CreatorRepository],
})
class CreatorModule {}

export { CreatorModule }
