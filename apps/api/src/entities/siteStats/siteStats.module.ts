import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"

import { ESiteStatsKey } from "./schemas/ESiteStatsKey"
import { SiteStats, SiteStatsSchema } from "./schemas/siteStats.schema"
import {
  SiteRatingsStats,
  SiteRatingsStatsSchema,
} from "./schemas/siteRatingsStats.schema"
import { SiteRatingsStatsRepository } from "./services/siteRatingsStats.repository"

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: SiteStats.name,
        schema: SiteStatsSchema,
        discriminators: [
          {
            name: SiteRatingsStats.name,
            schema: SiteRatingsStatsSchema,
            value: ESiteStatsKey.RATINGS,
          },
        ],
      },
    ]),
  ],
  providers: [SiteRatingsStatsRepository],
  exports: [SiteRatingsStatsRepository],
})
class SiteStatsModule {}

export { SiteStatsModule }
