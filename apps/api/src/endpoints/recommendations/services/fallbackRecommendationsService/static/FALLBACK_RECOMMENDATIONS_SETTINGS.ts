const FALLBACK_RECOMMENDATIONS_SETTINGS = {
  maxItemsPerType: 100,
  sourceOrder: ["popular", "newReleases", "popular", "newReleases", "popular"],
  personalSourceOrder: [
    "personal",
    "newReleases",
    "personal",
    "personal",
    "popular",
    "personal",
    "newReleases",
    "personal",
    "personal",
    "personal",
  ],
} as const

export { FALLBACK_RECOMMENDATIONS_SETTINGS }
