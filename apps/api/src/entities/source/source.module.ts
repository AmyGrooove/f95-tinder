import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"

import { Source, SourceSchema } from "./schemas/source.schema"
import { SourceRepository } from "./services/source.repository"

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Source.name, schema: SourceSchema }]),
  ],
  providers: [SourceRepository],
  exports: [SourceRepository],
})
class SourceModule {}

export { SourceModule }
