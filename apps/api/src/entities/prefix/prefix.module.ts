import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"

import { DatabaseModule } from "@infrastructure/database/database.module"

import { Prefix, PrefixSchema } from "./schemas/prefix.schema"
import { PrefixRepository } from "./services/prefix.repository"

@Module({
  imports: [
    DatabaseModule,
    MongooseModule.forFeature([{ name: Prefix.name, schema: PrefixSchema }]),
  ],
  providers: [PrefixRepository],
  exports: [PrefixRepository],
})
class PrefixModule {}

export { PrefixModule }
