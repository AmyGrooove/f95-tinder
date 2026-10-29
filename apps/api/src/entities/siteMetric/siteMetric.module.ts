import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"

import { ESiteMetricKey } from "./schemas/ESiteMetricKey"
import { SiteMetric, SiteMetricSchema } from "./schemas/siteMetric.schema"
import {
  SiteRatingsMetric,
  SiteRatingsMetricSchema,
} from "./schemas/siteRatingsMetric.schema"
import { SiteRatingsMetricRepository } from "./services/siteRatingsMetric.repository"

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: SiteMetric.name,
        schema: SiteMetricSchema,
        discriminators: [
          {
            name: SiteRatingsMetric.name,
            schema: SiteRatingsMetricSchema,
            value: ESiteMetricKey.RATINGS,
          },
        ],
      },
    ]),
  ],
  providers: [SiteRatingsMetricRepository],
  exports: [SiteRatingsMetricRepository],
})
class SiteMetricModule {}

export { SiteMetricModule }
