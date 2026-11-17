const RECOMMENDATION_RANKING_SETTINGS = {
  minPositiveItems: 5,
  algorithmCandidatesPerType: 500,
  rankOffset: 60,
  algorithmWeight: 0.5,
  plannedBonus: 0.05,
  sequelBonus: 0.5,
} as const

export { RECOMMENDATION_RANKING_SETTINGS }
