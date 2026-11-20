const FALLBACK_PAGE_SETTINGS = {
  namespace: "recommendations:fallback:v1",
  feedNamespace: "recommendations:feed:v1",
  ttl: 10 * 60 * 1000,
  defaultPageSize: 20,
} as const

export { FALLBACK_PAGE_SETTINGS }
