import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"

import { Fact, FactSchema } from "./schemas/fact.schema"
import { FactRepository } from "@entities/fact/services/factRepository"

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Fact.name, schema: FactSchema }]),
  ],
  providers: [FactRepository],
  exports: [FactRepository],
})
class FactModule {}

export { FactModule }
