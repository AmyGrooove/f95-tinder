import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type { Model } from "mongoose"

import { ESiteMetricKey } from "../schemas/ESiteMetricKey"
import { SiteRatingsMetric } from "../schemas/siteRatingsMetric.schema"
import { DEFAULT_SITE_RATING_AVERAGE } from "../static/DEFAULT_SITE_RATING_AVERAGE"
import type { IUpdateSiteRatingsMetricProps } from "../types/IUpdateSiteRatingsMetricProps"

@Injectable()
class SiteRatingsMetricRepository {
  constructor(
    @InjectModel(SiteRatingsMetric.name)
    private readonly ratingsModel: Model<SiteRatingsMetric>,
  ) {}

  async readRatingBaseline() {
    const metric = await this.ratingsModel
      .findOne({ key: ESiteMetricKey.RATINGS })
      .select({ average: 1 })
      .lean()
      .exec()

    return { average: metric?.average ?? DEFAULT_SITE_RATING_AVERAGE }
  }

  async applyChanges(props: IUpdateSiteRatingsMetricProps) {
    const metric = await this.ratingsModel
      .findOneAndUpdate(
        { key: ESiteMetricKey.RATINGS },
        [
          {
            $set: {
              createdAt: { $ifNull: ["$createdAt", "$$NOW"] },
              sum: { $add: [{ $ifNull: ["$sum", 0] }, props.sum] },
              count: { $add: [{ $ifNull: ["$count", 0] }, props.count] },
            },
          },
          {
            $set: {
              average: {
                $cond: [
                  { $gt: ["$count", 0] },
                  { $divide: ["$sum", "$count"] },
                  null,
                ],
              },
            },
          },
        ],
        {
          session: props.session,
          upsert: true,
          returnDocument: "after",
          updatePipeline: true,
        },
      )
      .orFail()
      .exec()

    await metric.validate()

    return metric
  }
}

export { SiteRatingsMetricRepository }
