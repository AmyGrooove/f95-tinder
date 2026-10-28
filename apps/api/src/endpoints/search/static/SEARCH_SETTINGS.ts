const SEARCH_SETTINGS = {
  indexes: {
    items: "site_items",
    users: "site_users",
    collections: "site_collections",
  },
  checkpointKey: "siteSearch:checkpoint:v2",
  batchSize: 500,
  maxTotalHits: 10_000,
} as const

export { SEARCH_SETTINGS }
