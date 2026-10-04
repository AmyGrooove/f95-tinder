import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"

import { Feature, FeatureSchema } from "./schemas/feature.schema"
import { FeatureRepository } from "./services/feature.repository"

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Feature.name, schema: FeatureSchema }]),
  ],
  providers: [FeatureRepository],
  exports: [FeatureRepository],
})
class FeatureModule {}

export { FeatureModule }
