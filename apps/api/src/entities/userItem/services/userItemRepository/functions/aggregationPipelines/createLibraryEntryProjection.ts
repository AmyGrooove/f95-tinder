import type { PipelineStage } from "mongoose"
import { EMediaType } from "@entities/shared/schemas/EMediaType"
import { createBriefUserItemProgress } from "../../../../functions/createBriefUserItemProgress"

const createLibraryEntryProjection = (
  isProgressVisible: boolean,
): PipelineStage.Project["$project"] => {
  return {
    createdAt: 1,
    status: 1,
    rating: 1,
    isFavorite: 1,
    item: {
      _id: "$visibleItem._id",
      type: "$visibleItem.type",
      title: "$visibleItem.title",
      media: {
        $filter: {
          input: { $ifNull: ["$visibleItem.media", []] },
          as: "media",
          cond: { $eq: ["$$media.type", EMediaType.POSTER] },
        },
      },
    },
    ratingAverage: {
      $ifNull: [{ $arrayElemAt: ["$stats.ratingAverage", 0] }, null],
    },
    movieDuration: { $ifNull: ["$visibleItem.movie.duration", null] },
    progress: isProgressVisible
      ? createBriefUserItemProgress("$latestAttempt")
      : { $literal: null },
  }
}

export { createLibraryEntryProjection }
