import type { RatingDistribution } from "../schemas/ratingDistribution.schema"

const RATING_DISTRIBUTION_VALUES = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
} satisfies Record<keyof RatingDistribution, number>

export { RATING_DISTRIBUTION_VALUES }
