import type { PipelineStage } from "mongoose"
import { EMediaType } from "@entities/shared/schemas/EMediaType"

const createPosterCardProjection = (
  details: PipelineStage.Project["$project"],
): PipelineStage.Project["$project"] => {
  return {
    _id: 1,
    type: 1,
    title: 1,
    media: {
      $filter: {
        input: { $ifNull: ["$media", []] },
        as: "media",
        cond: { $eq: ["$$media.type", EMediaType.POSTER] },
      },
    },
    ...details,
  }
}

export { createPosterCardProjection }
