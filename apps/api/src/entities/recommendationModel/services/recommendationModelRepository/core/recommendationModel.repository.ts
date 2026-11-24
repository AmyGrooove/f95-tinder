import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type { Model } from "mongoose"

import { RecommendationModel } from "../../../schemas/RecommendationModel.schema"

@Injectable()
class RecommendationModelRepository {
  constructor(
    @InjectModel(RecommendationModel.name)
    private readonly model: Model<RecommendationModel>,
  ) {}

  readLatest() {
    return this.model
      .findOne()
      .sort({ createdAt: -1, _id: -1 })
      .setOptions({ promoteBuffers: true })
      .lean<Record<string, unknown> | null>()
      .exec()
  }
}

export { RecommendationModelRepository }
