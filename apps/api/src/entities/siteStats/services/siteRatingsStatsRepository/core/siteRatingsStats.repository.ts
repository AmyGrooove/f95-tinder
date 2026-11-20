import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type { Model } from "mongoose"

import { ESiteStatsKey } from "../../../schemas/ESiteStatsKey"
import { SiteRatingsStats } from "../../../schemas/siteRatingsStats.schema"
import { createSiteRatingsStatsUpdatePipeline } from "../functions/aggregationPipelines/createSiteRatingsStatsUpdatePipeline"
import type { IUpdateSiteRatingsStatsProps } from "../types/IUpdateSiteRatingsStatsProps"

@Injectable()
class SiteRatingsStatsRepository {
  constructor(
    @InjectModel(SiteRatingsStats.name)
    private readonly model: Model<SiteRatingsStats>,
  ) {}

  async readAverage() {
    const metric = await this.model
      .findOne({ key: ESiteStatsKey.RATINGS }, { average: 1 })
      .lean()
      .exec()

    return metric?.average ?? null
  }

  async applyChanges(props: IUpdateSiteRatingsStatsProps) {
    const { sum, count, session } = props

    const metric = await this.model
      .findOneAndUpdate(
        { key: ESiteStatsKey.RATINGS },
        createSiteRatingsStatsUpdatePipeline(sum, count),
        {
          session,
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
