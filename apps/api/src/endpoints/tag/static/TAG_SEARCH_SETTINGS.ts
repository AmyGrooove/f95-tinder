const TAG_SEARCH_SETTINGS = {
  index: "site_tags",
  checkpointKey: "tagSearch:checkpoint:v1",
  batchSize: 500,
  maxTotalHits: 10_000,
  ungrouped: "ungrouped",
} as const

export { TAG_SEARCH_SETTINGS }
