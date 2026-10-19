import { Module } from "@nestjs/common"

import { BannedItemModule } from "@entities/bannedItem/bannedItem.module"
import { FeatureModule } from "@entities/feature/feature.module"
import { ItemModule } from "@entities/item/item.module"
import { SourceModule } from "@entities/source/source.module"
import { JobsModule } from "@infrastructure/jobs/jobs.module"
import { SecurityModule } from "@infrastructure/security/security.module"

import { MovieImportController } from "./controllers/movieImport.controller"
import { CollectNewKodikMoviesJobHandler } from "./handlers/collectNewKodikMoviesJob.handler"
import { KodikMoviesService } from "./services/kodikMovies.service"

@Module({
  imports: [
    BannedItemModule,
    FeatureModule,
    ItemModule,
    SourceModule,
    JobsModule,
    SecurityModule,
  ],
  controllers: [MovieImportController],
  providers: [KodikMoviesService, CollectNewKodikMoviesJobHandler],
})
class MovieImportModule {}

export { MovieImportModule }
