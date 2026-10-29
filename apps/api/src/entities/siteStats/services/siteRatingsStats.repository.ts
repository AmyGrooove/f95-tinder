import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type { Model } from "mongoose"

import { ESiteStatsKey } from "../schemas/ESiteStatsKey"
import { SiteRatingsStats } from "../schemas/siteRatingsStats.schema"
import { DEFAULT_SITE_RATING_AVERAGE } from "../static/DEFAULT_SITE_RATING_AVERAGE"
import type { IUpdateSiteRatingsStatsProps } from "../types/IUpdateSiteRatingsStatsProps"

@Injectable()
class SiteRatingsStatsRepository {
  constructor(
    @InjectModel(SiteRatingsStats.name)
    private readonly ratingsModel: Model<SiteRatingsStats>,
  ) {}

  async readRatingBaseline() {
    const metric = await this.ratingsModel
      .findOne({ key: ESiteStatsKey.RATINGS })
      .select({ average: 1 })
      .lean()
      .exec()

    return { average: metric?.average ?? DEFAULT_SITE_RATING_AVERAGE }
  }

  async applyChanges(props: IUpdateSiteRatingsStatsProps) {
    const metric = await this.ratingsModel
      .findOneAndUpdate(
        { key: ESiteStatsKey.RATINGS },
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

export { SiteRatingsStatsRepository }
