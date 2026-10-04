import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"

import { ItemFeature, ItemFeatureSchema } from "./schemas/itemFeature.schema"
import { ItemFeatureRepository } from "./services/itemFeature.repository"

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ItemFeature.name, schema: ItemFeatureSchema },
    ]),
  ],
  providers: [ItemFeatureRepository],
  exports: [ItemFeatureRepository],
})
class ItemFeatureModule {}

export { ItemFeatureModule }
