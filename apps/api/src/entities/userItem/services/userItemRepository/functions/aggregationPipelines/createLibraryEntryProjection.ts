import type { PipelineStage } from "mongoose"
import { EMediaType } from "@entities/shared/schemas/EMediaType"

const createLibraryEntryProjection = (
  isProgressVisible: boolean,
): PipelineStage.Project["$project"] => {
  return {
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
    progress: isProgressVisible
      ? {
          $cond: [
            { $ne: [{ $ifNull: ["$latestAttempt.progress", null] }, null] },
            {
              value: "$latestAttempt.progress",
              unit: "$latestAttempt.unit",
            },
            null,
          ],
        }
      : { $literal: null },
  }
}

export { createLibraryEntryProjection }
