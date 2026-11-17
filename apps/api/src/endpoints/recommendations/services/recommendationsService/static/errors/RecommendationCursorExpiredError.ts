import { DICTIONARY } from "@entities/shared/static/DICTIONARY"

class RecommendationCursorExpiredError extends Error {
  readonly code = "RECOMMENDATION_CURSOR_EXPIRED"

  constructor() {
    super(DICTIONARY.recommendation.cursorExpired)
    this.name = "RecommendationCursorExpiredError"
  }
}

export { RecommendationCursorExpiredError }
