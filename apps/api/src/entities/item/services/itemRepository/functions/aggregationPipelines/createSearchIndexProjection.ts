import type { PipelineStage } from "mongoose"

const createSearchIndexProjection = (): PipelineStage.Project["$project"] => {
  return {
    _id: 1,
    type: 1,
    title: 1,
    aliases: 1,
    description: 1,
    media: 1,
    releaseDate: 1,
    ageRestriction: 1,
    movie: 1,
    series: 1,
    game: 1,
    deletedAt: 1,
    tagIds: "$searchTags.tag",
    ratingsCount: {
      $ifNull: [{ $arrayElemAt: ["$searchMetrics.ratingsCount", 0] }, 0],
    },
    rating: {
      $ifNull: [{ $arrayElemAt: ["$searchMetrics.ratingAverage", 0] }, null],
    },
  }
}

export { createSearchIndexProjection }
